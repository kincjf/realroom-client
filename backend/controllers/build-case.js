/**
 * Created by KIMSEONHO on 2016-08-27.
 */
"use strict";

const _ = require('lodash');
const multer = require('multer');
const path = require('path');
const fsp = require('fs-promise');
const Promise = require("bluebird");

var env = process.env.NODE_ENV || "development";
var config = require("../config/main")[env];

var log = require('console-log-level')({
  prefix: function () {
    return new Date().toISOString()
  },
  level: config.logLevel
});

const genToken = require('../utils/genToken');
const staticValue = require('../utils/staticValue');
const models = require('../models');
const vrpanoPromise = require('../modules/convert-vrpano-promise');


const Member = models.Member;
const BuildCaseInfoBoard = models.BuildCaseInfoBoard;

const fieldName = {
  prevImg: "previewImage",
  vrImg: "vrImage"
}
//========================================
// Build Case Routes
//========================================
/**
 * 시공 사례 리스트 조회
 * @param req
 * @param res
 * @param next
 */
exports.viewBuildCaseList = function (req, res, next) {
  let pageSize, pageStartIndex;

  if (!req.query.pageSize || !req.query.pageStartIndex) {
    // query가 제대로 오지 않으면 초기값으로 보낸다.
    pageSize = 10;
    pageStartIndex = 0;
  } else {
    pageSize = _.toNumber(req.query.pageSize);
    pageStartIndex = _.toNumber(req.query.pageStartIndex);
  }

  // ex> pageSize가 10이고, pageStartIndex가 10이면
  // return 데이터(Index 기준)는 10~19, 총 10개이다.
  BuildCaseInfoBoard.findAll({
    limit: pageSize,
    offset: pageStartIndex
  }).then(function (buildCases) {
    res.status(200).json({buildCaseInfo: buildCases, statusCode: 1});
    return next();
  }).catch(function (err) {
    if (err) {
      res.status(400).json({
        errorMsg: 'No BuildCase could be found for pageSize, pageStartIndex.',
        statusCode: -1
      });
      return next(err);
    }
  });
}


// 동일 중복 파일을 체크할 수 있도록 개발해야함
// Media Management System을 만들거나, 간단한 checksum으로 필터링을 해야함.
/**
 * 시공사례입력(use vrpano-promise)
 * @param req
 * @param res
 * @param next
 */
exports.createBuildCaseAndVRPano = function (req, res, next) {
  if (req.user.memberType != staticValue.memberType.BusinessMember) {
    return res.status(401).json({
      errorMsg: 'You are not authorized to create build case.',
      statusCode: 2
    });
  }

  // console.log("req body Json : %j", ${req.body});
  // console.log("req body Json : %j", ${req.files});

  if (!req.body.title) {
    return res.status(401).json({
      errorMsg: 'You must enter an required field! please check title',
      statusCode: -1
    });
  }


  // req.files["fieldname"[i] - structure example
  // { fieldname: 'myfile',
  //   originalname: '20160224_104138.jpg',
  //   encoding: '7bit',
  //   mimetype: 'image/jpeg',
  //   destination: '/tmp/upload/',
  //   filename: '8563e0bef6efcc4d709f2d1debb35777',
  //   path: '/tmp/upload/8563e0bef6efcc4d709f2d1debb35777',
  //   size: 1268337 }

  let previewImage, vrImages, vrImagePaths;

  let makeNewSavePath = Promise.method(function () {
    let newSavePath;
    if (req.files['previewImage'] || req.files['vrImage']) {
      newSavePath = _.toString(Date.now());

      return newSavePath;
    }

    return newSavePath;    // 파일 이동 실패, 파일 없음
  });

  /**
   * String
   */
  let movePreviewImage = Promise.method(function (newSavePath) {

    if (newSavePath && req.files[fieldName.prevImg]) {
      let previewImgFile = req.files[fieldName.prevImg][0];
      let savePath = path.join(previewImgFile.destination, newSavePath, previewImgFile.filename);

      return fsp.move(previewImgFile.path, savePath).then(function () {
        previewImgFile.destination = path.join(previewImgFile.destination, newSavePath);
        previewImgFile.path = path.join(previewImgFile.destination, previewImgFile.filename);

        // path의 "config.resourcePath" 포함 앞부분 문자열은 삭제한다.
        let tmpPath = _.replace(previewImgFile.path, config.resourcePath + path.sep, "");

        // previewImage = _.replace(tmpPath, "/\\/g", "/");    // 될거 같은데 안됨...
        previewImage = _.split(tmpPath, "\\").join('/');    // 아 ㅅㅂ path문제... 정규표현식으로 해결이 안됨
        // url path이기 때문에 windows에서 작동할 경우 separator(\\) 변환 필요

        return previewImage;
      }).catch(function (err) {
        return new Error("fail to move previewImage file");    // 파일 이동 실패, transaction 중지
      });
    }

    return null;    // 파일 없음(에러는 아님)
  });

  /**
   * Object
   */
  let moveVRImage = Promise.method(function (newSavePath) {
    if (newSavePath && req.files[fieldName.vrImg]) {
      vrImagePaths = [];

      vrImages = {
        statusCode: 0,    // 아직 변환 전임을 표시함
        // baseDir: _.split(tmpPath, "\\").join('/'),   // request path이기 때문에
        originalImage: []    // 변환전 파일 경로
      };

      return Promise.each(req.files[fieldName.vrImg], function (file, index, length) {
        let baseDir = path.join(file.destination, newSavePath);
        let savePath = path.join(baseDir, file.filename);

        return fsp.move(file.path, savePath).then(function () {
          file.destination = path.join(file.destination, newSavePath);
          file.path = path.join(file.destination, file.filename);

          // let tmpPath = _.replace(file.destination, "uploads" + path.sep, "");
          let tmpPath = _.replace(file.destination, config.resourcePath + path.sep, "");

          vrImages.baseDir = _.split(tmpPath, "\\").join('/');   // request path이기 때문에

          vrImages.originalImage.push(file.filename);
          vrImagePaths.push(file.path);
        }).catch(function (err) {
          return new Error("fail to move vrImage file");    // 파일 이동 실패, transaction 중지
        });
      }).then(function () {
        return vrImages;
      });
    }

    return null;    // 파일 없음(에러는 아님)
  });


  /**
   * String, Array[String]
   */
  let createBuildCaseDB = Promise.method(function (previewImagePath, vrImages, originalVRImages) {

    const buildCase = {
      memberIdx: req.user.idx,
      title: req.body.title,
      buildType: req.body.buildType == "" ? null : req.body.buildType,
      buildPlace: req.body.buildPlace == "" ? null : req.body.buildPlace,
      buildTotalArea: req.body.buildTotalArea == "" ? null : _.toNumber(req.body.buildTotalArea),
      mainPreviewImage: _.isNil(previewImagePath) ? null : previewImagePath,
      buildTotalPrice: req.body.buildTotalPrice == "" ? null : _.toNumber(req.body.buildTotalPrice),
      HTMLText: req.body.HTMLText == "" ? null : req.body.HTMLText,
      VRImages: _.isNil(vrImages) ? null : JSON.stringify(vrImages)   // 현재는 변환 전임을 표시함.
    }

    return BuildCaseInfoBoard.create(buildCase).then(function (newBuildCase) {
      res.status(201).json({
        buildCaseInfo: newBuildCase,
        statusCode: staticValue.statusCode.RequestActionCompleted_20x
      });

      return [originalVRImages, newBuildCase.idx];
    }).spread(function (originalVRImages, buildCaseIdx) {

      if (originalVRImages) {
        return vrpanoPromise(originalVRImages).then(() => {   // VR 이미지가 있으면 변환하게 고쳐야함.
          log.debug('[convert-vrpano-promise] done!');
          return Promise.resolve(buildCaseIdx);
        }).catch(err => {
          log.error('[convert-vrpano-promise] ERROR: ', err);
        });    // 비동기로 작동한다.

      } else {
        return new Error('no originalVRImages in req.files');
      }
    }).catch(function (err) {
      if (err) {
        res.status(400).json({
          errorMsg: 'BuildCaseInfoBoard Error : No BuildCase could be create for this info.',
          statusCode: 2
        });
        return next(err);
      }
    });
  });

  let saveVRPanoPath = Promise.method(function (newIdx) {
    if (newIdx) {
      return BuildCaseInfoBoard.findById(newIdx).then(buildCaseInfo => {
        let vrImageObj = JSON.parse(buildCaseInfo.VRImages);    // Array[fileName, ...]

        vrImageObj.statusCode = 1;    // 변환 완료
        vrImageObj.vtourDir = "vtour";    // vtour-normal-custom.config에서 설정함
        vrImageObj.xmlName = "tour.xml";    // vtour-normal-custom.config에서 설정함
        vrImageObj.swfName = "tour.swf";    // vtour-normal-custom.config에서 설정함
        vrImageObj.jsName = "tour.js";    // vtour-normal-custom.config에서 설정함

        vrImageObj.tiles = [];

        let prevImageName = 'thumb.jpg';   // vtour-normal-custom.config에서 설정함

        _(vrImageObj.originalImage).forEach(value => {
          let extension = path.extname(value);    // imagefile name의 확장자부분만 추출
          let imageName = path.basename(value, extension);    // imagefile name의 파일 이름만 추출
          // let imagePath = imageName + extension;
          // requestpath이기 때문에
          let tmpDir = path.join(vrImageObj.baseDir, config.krpano.panotour_path, imageName + ".tiles");
          let tileDir = _.split(tmpDir, "\\").join('/');

          vrImageObj.tiles.push({
            dir: tileDir,
            previewImageName: prevImageName,
            previewImagePath: _.join([tileDir, prevImageName], "/")   // 편하게 쓰라고 만들어준거임
          });
        });

        return buildCaseInfo.update({
          VRImages: JSON.stringify(vrImageObj)    // convert 된 후의 정보가 들어감
        }).then(result => {
          return 'buildCaseInfo: changed VRImages : ' + result.VRImages;
        }).catch(err => {
          return new Error('update buildCaseInfo error: ' + err);
        });
      }).catch(function (err) {
        return new Error('fileById buildCaseInfo/' + newIdx + ' error: ' + err);
      });
    }

    return new Error('no buildCaseInfo newIdx');
  });

  makeNewSavePath()
    .then(function (newSavePath) {
      return Promise.join(movePreviewImage(newSavePath), moveVRImage(newSavePath), function (previewImage, vrImages) {
        return {previewImage: previewImage, vrImages: vrImages};
      });
    }).then(function (result) {
    return createBuildCaseDB(result.previewImage, result.vrImages, vrImagePaths);
  }).then(function (newIdx) {
    return saveVRPanoPath(newIdx);
  }).done(function (result) {
    log.debug(result);
  }, function (err) {
    log.err(err);
  });
}


// 1. 동일 중복 파일을 체크할 수 있도록 개발해야함
// 2. Media Management System을 만들거나, 간단한 checksum으로 필터링을 해야함.
// 3. 현재 상황으로는 특히 VR Panorama에 대한 수정시 다시 만들어야되는 결함이 있다.
// 일단 중복으로 파일 수정이 되어 VR파노라마가 생성되게 하고,
// 차후에 파일이 중복으로 첨부되었을 경우, 중복 처리를 통해서 업로드 되지 않게 한다.
// vrpano module을 수정하여 자체적으로 module을 만드는 방벋도 고려해야한다.
// multer({fileFilter})를 이용하기.
// 5. 현재는 VR파노라마는 수정이 되지 않음.
// VR 파노라마를 변경하고 싶을 경우, 삭제하고 다시 BuildCase를 만들것!
//
/**
 * 시공 사례 수정
 * @param req
 * @param res
 * @param next
 */
exports.updateBuildCase = function (req, res, next) {
  if ((req.user.memberType != staticValue.memberType.BusinessMember)) {
    return res.status(401).json({
      errorMsg: 'You are not authorized to create build case.',
      statusCode: 2
    });
  }

  if (!req.body.title || req.params.buildCaseIdx) {
    return res.status(401).json({
      errorMsg: 'You must enter an required field! please check title, :buildCaseIdx',
      statusCode: -1
    });
  }

  const buildCaseIdx = _.toNumber(req.params.buildCaseIdx);
  let previewImagePath;
  if (req.files['previewImage']) {
    // const previewImagePath = req.files['prewviewImage'][0].originalname;
    previewImagePath = req.files['previewImage'][0].name;
  }

  // let vrImagePath;
  // if (req.files['vrImage']) {
  //   vrImagePath = [];
  //
  //   _forEach(req.files['vrImage'], function (file, key) {
  //     if (file) {
  //       vrImagePath.push(file.name);
  //     }
  //   });
  // }

  const buildCase = {
    memberIdx: req.user.idx,
    title: req.body.title,
    buildType: req.body.buildType == "" ? null : req.body.buildType,
    buildPlace: req.body.buildPlace == "" ? null : req.body.buildPlace,
    buildTotalArea: req.body.buildTotalArea == "" ? null : _.toNumber(req.body.buildTotalArea),
    mainPreviewImage: _.isNil(previewImagePath) ? null : previewImagePath,
    buildTotalPrice: req.body.buildTotalPrice == "" ? null : _.toNumber(req.body.buildTotalPrice),
    HTMLText: req.body.HTMLText == "" ? null : req.body.HTMLText,
  }

  // return Array[0] = affectedRows
  BuildCaseInfoBoard.update(buildCase, {where: {idx: buildCaseIdx}}).then(function (array) {
    return res.status(200).json({
      msg: 'changed ' + array[0] + ' rows',
      statusCode: 1
    });
  }).catch(function (err) {
    if (err) {
      res.status(400).json({
        errorMsg: 'BuildCaseInfoBoard Error : No user could be found for this ID.',
        statusCode: 2
      });
      return next(err);
    }
  });
}


/**
 * 시공사례 상세보기
 * @param req
 * @param res
 * @param next
 */
exports.viewBuildCase = function (req, res, next) {
  if (!req.params.buildCaseIdx) {
    return res.status(401).json({
      errorMsg: 'You must enter an required field! please check :buildCaseIdx',
      statusCode: -1
    });
  }

  const buildCaseIdx = _.toNumber(req.params.buildCaseIdx);

  BuildCaseInfoBoard.findById(buildCaseIdx).then(function (buildCase) {
    return res.status(200).json({buildCaseInfo: buildCase, statusCode: 1});
  }).catch(function (err) {
    if (err) {
      res.status(400).json({
        errorMsg: 'BuildCaseInfoBoard : No user could be found for this ID.',
        statusCode: -1
      });
      return next(err);
    }
  });
}


/**
 * 시공사례 검색(2)
 * @param req
 * @param res
 * @param next
 */
exports.searchBuildCase = function (req, res, next) {
  BuildCaseInfoBoard.findAll().then(function (buildCases) {
    res.status(200).json({buildCaseInfo: buildCases, statusCode: 1});
    return next();
  }).catch(function (err) {
    if (err) {
      res.status(400).json({
        errorMsg: 'No BuildCase could be found..',
        statusCode: -1
      });
      return next(err);
    }
  })
};


/**
 * 시공사례 삭제(3)
 * @param req
 * @param res
 * @param next
 */
exports.deleteBuildCase = function (req, res, next) {
  if ((req.user.memberType != staticValue.memberType.BusinessMember)) {
    return res.status(401).json({
      errorMsg: 'You are not authorized to create build case.',
      statusCode: 2
    });
  }

  if (!req.params.buildCaseIdx) {
    return res.status(401).json({
      errorMsg: 'You must enter an required field! please check title, :buildCaseIdx',
      statusCode: -1
    });
  }

  const buildCaseIdx = _.toNumber(req.params.buildCaseIdx);

  // return numOfRows = The number of destroyed rows
  BuildCaseInfoBoard.destroy({where: {idx: buildCaseIdx}}).then(function (numOfRows) {
    res.status(200).json({
      msg: 'deleted ' + numOfRows + ' rows',
      statusCode: 1
    });
    return next();
  }).catch(function (err) {
    if (err) {
      res.status(400).json({
        errorMsg: 'No user could be found for this ID.',
        statusCode: -1
      });
      return next(err);
    }
  });
}
