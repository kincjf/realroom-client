/**
 * Created by KIMSEONHO on 2016-09-08.
 */
var spawn = require('child-process-promise').spawn;
var addToPath = require('add-to-path');   // process.env.path 등록

var os = require('os');
var path = require('path');
var _ = require('lodash');

var env = process.env.NODE_ENV || "development";
var config = require('../config/main')[env];

var log = require('console-log-level')({
  prefix: function () { return new Date().toISOString() },
  level: config.logLevel
})

var platform = os.platform();
var arch = os.arch();

var shell, scriptFile, vtourConfig, toolPath;

if (platform === 'linux') {
// HACK: to make our calls to exec() testable,
// support using a mock shell instead of a real shell
  shell = process.env.SHELL || 'sh';
  addToPath(config.krpano.linux);
  scriptFile = "krpanotools";

}
else if (platform === 'win32' && process.env.SHELL === undefined) {
  // support for Win32 outside Cygwin
  shell = process.env.COMSPEC || 'cmd.exe';
  addToPath(config.krpano.win);

  if (arch == 'x64') {
    scriptFile = "krpanotools64.exe";
  } else if (arch == 'ia32') {        // 32bit
    scriptFile = "krpanotools32.exe";
  } else {        // arm등
    log.error("not support for " + arch);
  }
}

vtourConfig = config.krpano.vtour_config;

/**
 * Convert spherical image to cubical image and save converted info to DB
 * Tour VR로 변환 후 변환 여부에 따라 DB에 데이터를 저장한다.
 * @param idx
 * @param imagePaths
 * @returns {number}
 */
module.exports = function(imagePaths) {
  if (!scriptFile) {
    log.error("not compatible with machine OS :  " + arch);
    return 1;
  }

  if (!imagePaths) {
    log.error("must pass argument(imagePaths) :  " + imagePaths);
    return 1;
  }

  const configArgs = "-config=" + vtourConfig;
  const makepanoArgs = _.concat(["makepano", configArgs], imagePaths);

  // image 파일이 존재하는지에 대한 검증은 하지 못함
  // 이미지 파일이 존재하지 않아도 echo(stdout)로 출력됨, stderr = ""
  // process option을 변수를 선언하여 재활용 했더니 에러가 난다
  // 왜 그런지는 모르겠지만, 번거롭더라도 직접 object를 넣어주어야
  // 의도대로 잘 작동한다.

  // 현재 서버와 같이 돌릴 경우에는 자원이 많이 소모되는 작업이기 때문에
  // 동시 변환이 불가능 할 것 이다.
  // 그래서 별도 서버를 설치하고 queue를 이용한 batch processing을 수행해야 한다.
  // 일단 임시방편으로 이렇게 제작하자.

  // run convert cubical
  var promise = spawn(scriptFile, makepanoArgs, {
    cwd: undefined,
    env: process.env
  })

  var childProcess = promise.childProcess;

  log.debug('[convert-vrpano-promise] childProcess.pid: ', childProcess.pid);
  childProcess.stdout.on('data', (data) => {
    log.debug(`[convert-vrpano-promise] stdout: ${data}`);
  });

  childProcess.stderr.on('data', (data) => {
    log.debug(`[convert-vrpano-promise] stderr: ${data}`);
  });

  return promise;
}
