import axios from 'axios';
import AWS from 'aws-sdk';
const lambda = new AWS.Lambda();

export const handler = async (event) => {
  try {

    const url = `https://graph.facebook.com/v19.0/${event.instagram_business_account.id}/media?fields=id,media_product_type&access_token=${event.tokenInfo.access_token}`;
    let result = await axios.get(url);
    
    const tempArr = [];
    tempArr.push(...result.data.data);
    while(result.data.paging.next) {
      result = await axios.get(result.data.paging.next);
      tempArr.push(...result.data.data);
    }
    
    // media_product_type 이 REELS 인 경우만 추출
    const reelsIds = tempArr.filter(item => item.media_product_type === 'REELS');
    
    // 스토리 id 정보로 람다 요청 처리 - 스토리가 많을수도 있음
    const invokeArr = [];
    for (let item of reelsIds) {
      const data = { 
        media_id: item.id,
        access_token: event.tokenInfo.access_token,
        userId: event.userId,
        id: event.instagram_business_account.id
      };
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-instagram-request-reels-insight',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(data),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }
    const invokeResults = await Promise.all(invokeArr);
    
    // 오류가 있었던 데이터 제외
    const reelPosts = [];
    for (const item of invokeResults) {
      const temp = JSON.parse(item.Payload);
      // console.log('temp = ', temp);
      if (temp.statusCode === 200) reelPosts.push(temp.body);
    }
    
    // TODO implement
    const response = {
      statusCode: 200,
      body: reelPosts,
    };
    return response;
  } catch (error) {
    return {
      statusCode: 500,
      // body: JSON.stringify('Internal Server Error'),
      body: 'Internal Server Error',
    };
  }
};
