import axios from 'axios';
import AWS from 'aws-sdk';
const lambda = new AWS.Lambda();

export const handler = async (event) => {
  try {
    console.info('event =', event);

    const url1 = `https://graph.facebook.com/v19.0/${event.id}/stories?fields=media_id,media_type&access_token=${event.access_token}`;
    let result1 = await axios.get(url1);
    const tempArr2 = [];
    tempArr2.push(...result1.data.data);
    while(result1.data.paging.next) {
      result1 = await axios.get(result1.data.paging.next);
      tempArr2.push(...result1.data.data);
    }
    // media_type 이 video인 경우만 추출
    const mediaIds = tempArr2.filter(item => item.media_type === 'video');
    
    // 스토리 id 정보로 람다 요청 처리 - 스토리가 많을수도 있음
    const invokeArr = [];
    for (let item of mediaIds) {
      const data = { 
        media_id: item.media_id,
        access_token: event.access_token,
        userId: event.userId,
        id: event.id
      };
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-facebook-request-stories-insight',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(data),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }
    const invokeResults = await Promise.all(invokeArr);
    
    // 오류가 있었던 데이터 제외
    const storyPosts = [];
    for (const item of invokeResults) {
      const temp = JSON.parse(item.Payload);
      // console.log('temp = ', temp);
      if (temp.statusCode === 200) storyPosts.push(temp.body);
    }
    
    // TODO implement
    const response = {
      statusCode: 200,
      body: storyPosts,
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
