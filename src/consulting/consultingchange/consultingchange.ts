/**
 * Created by InSuJeong on 2016-09-13.
 */
import { Component } from '@angular/core';
import { Router, ROUTER_DIRECTIVES } from '@angular/router';
import { CORE_DIRECTIVES, FORM_DIRECTIVES } from '@angular/common';
import { Http,Headers } from '@angular/http';
import { contentHeaders } from '../../common/headers';

const template = require('./consultingchange.html');

@Component({
  selector: 'consultingChange',
  directives: [ CORE_DIRECTIVES, FORM_DIRECTIVES, ROUTER_DIRECTIVES ],
  template: template
})


export class ConsultingChange {
  jwt:string;
  decodedJwt: string;
  public data;
  idx: number;
  currenttitle: string;
  currentprefBizMemberIdx: number;
  currentuserName: string;
  currenttelephone: string;
  currentemail: string;
  currentbuildType: string;
  currentbuildPlace: string;
  currentlived: number;
  currentexpectBuildTotalArea: number;
  currentexpectBuildPrice: number;
  currentexpectConsultDate: Date;
  currentexpectBuildStartDate: Date;
  currentreqContents: string;

  consulting: number;

  constructor(public router: Router, public http: Http) {
    this.jwt = localStorage.getItem('id_token'); //login시 저장된 jwt값 가져오기
    this.decodedJwt = this.jwt && window.jwt_decode(this.jwt);//jwt값 decoding
    contentHeaders.append('Authorization',this.jwt);//Header에 jwt값 추가하기

    this.consulting=localStorage.getItem('consultingDetail');

    this.http.get('http://localhost:3001/api/consult/'+this.consulting, {headers:contentHeaders}) //서버로부터 필요한 값 받아오기
      .map(res => res.json())//받아온 값을 json형식으로 변경
      .subscribe(
        response => {
          this.data = response; // 해당값이 제대로 넘어오는지 확인후 프론트단에 내용추가
          this.idx = this.data.consult.idx;
          this.currenttitle = this.data.consult.title;
          this.currentprefBizMemberIdx = this.data.consult.prefBizMemberIdx;
          this.currentuserName = this.data.consult.userName;
          this.currenttelephone = this.data.consult.telephone;
          this.currentemail = this.data.consult.email;
          this.currentbuildType = this.data.consult.buildType;
          this.currentbuildPlace = this.data.consult.buildPlace;
          this.currentlived = this.data.consult.lived;
          this.currentexpectBuildTotalArea = this.data.consult.expectBuildTotalArea;
          this.currentexpectBuildPrice = this.data.consult.expectBuildPrice;
          this.currentexpectConsultDate = this.data.consult.expectConsultDate;
          this.currentexpectBuildStartDate = this.data.consult.expectBuildStartDate;
          this.currentreqContents = this.data.consult.reqContents;
        },
        error => {
          alert(error.text());
          console.log(error.text());
          //서버로부터 응답 실패시 경고창
        }
      );
  }


  consultingchanging(event, title, buildType, userName, telephone, email, expectBuildPrice, buildPlace, expectBuildTotalArea, expectBuildStartDate, expectConsultDate, reqContents){
    event.preventDefault();
    //lived에 들어갈 radio버튼에서 체크된 값 가져오기
    var lived 		= $(':radio[name="optionsRadios"]:checked').val();
    //html받은 값들을 json형식으로 저장
    let body= JSON.stringify({title, buildType, userName, telephone, email, expectBuildPrice, buildPlace, lived, expectBuildTotalArea, expectBuildStartDate, expectConsultDate, reqContents});

    this.http.put('http://localhost:3001/api/consult/'+this.consulting, body, {headers: contentHeaders})
      .subscribe(
        response => {
          this.router.navigate(['/mainPage']);
          //서버로부터 응답 성공시 home으로 이동
        },
        error => {
          alert(error.text());
          console.log(error.text());
          //서버로부터 응답 실패시 경고창
        }
      );

  }
  cancel(){
    contentHeaders.delete('Authorization');//기존에 jwt값을 지우기 위해 실행
  }



}