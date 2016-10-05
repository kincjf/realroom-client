/**
 * Created by insu on 2016-09-02.
 */
import { Component } from '@angular/core';
import { Router, ROUTER_DIRECTIVES } from '@angular/router';
import { CORE_DIRECTIVES, FORM_DIRECTIVES } from '@angular/common';
import { Http } from '@angular/http'
import { contentHeaders } from '../../common/headers';
import { config } from '../../common/config';

const template = require('./bizList.html');

@Component({
  selector: 'bizList',
  directives: [ ROUTER_DIRECTIVES, CORE_DIRECTIVES, FORM_DIRECTIVES ],
  template: template
})

/**
 *
 */
export class BizList {
  jwt: string;
  public data;

  pageSize: number;
  pageStartIndex: number;
  selectedmemberIdx: number;

  returnedDatas = [];

  constructor(public router: Router, public http: Http) {
    this.pageSize = 4;
    this.pageStartIndex=0;

    let URL = [config.serverHost, config.path.bizStore + "?pageSize=" + this.pageSize + '&pageStartIndex=' + this.pageStartIndex].join('/');

    this.http.get(URL, {headers:contentHeaders}) //서버로부터 필요한 값 받아오기
      .map(res => res.json())//받아온 값을 json형식으로 변경
      .subscribe(
        response => {
          this.data = response; // 해당값이 제대로 넘어오는지 확인후 프론트단에 내용추가

          //for of문으로 for–of 루프 구문은 배열의 요소들, 즉 data를 순회하기 위한 구문입니다.
          for(var bizUser of response.bizUserInfo) {
            //returnDatas에 bizUser의 정보를 data의 수만큼 받아온다.
            this.returnedDatas.push({
              memberIdx: bizUser.memberIdx,
              companyName: bizUser.companyName,
              aboutCompanyShort: bizUser.aboutCompanyShort
            });
          }

        },
        error => {
          alert(error.text());
          console.log(error.text());
          //서버로 부터 응답 실패시 경고창
        }
      )

  }

  onSelectBizList(bizUser: bizUserInfo): void {
    this.selectedmemberIdx = bizUser;//bizUser는 클릭한 업체의 정보를 가지고 있고 이 정보를 selectedmemberIdx로 옮겼다.
    localStorage.setItem('bizUserDetail',bizUser.memberIdx);
    //서버로부터 응답 성공시 home으로 이동
  }
}