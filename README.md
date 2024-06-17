# sns-post-dashboard-oauth
- 페이스북, 인스타그램, 유튜브, 틱톡 Oauth code 방식 계정연동
- AWS Lambda를 통해 계정별 영상 게시물에 대한 인사이트 api 병렬 요청
- AWS Lambda에서 다른 인사이트 Lambda를 호출하는 경우는 인사이트 지표가 단일 api에서 모두 받을수 없는 경우입니다
- Dashboard로 표현하기 위한 인사이트 field mapping

![account](./account.jpeg)
![dashboard](./dashboard.jpeg)