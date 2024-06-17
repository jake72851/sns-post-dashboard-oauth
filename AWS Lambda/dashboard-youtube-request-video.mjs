import { google } from 'googleapis';
import AWS from 'aws-sdk';
const lambda = new AWS.Lambda();

export const handler = async (event) => {
  try {
    
    // 프로젝트 : for-marketing
    const oauth2Client = new google.auth.OAuth2(
      event.clientId, // Google Cloud에서 생성한 OAuth 2.0 클라이언트 ID
      event.clientSecret, // 클라이언트 시크릿
      event.redirectUrl // 리디렉트 URI
    );
    
    oauth2Client.setCredentials({
      access_token: event.tokenInfo.access_token,
      refresh_token: event.tokenInfo.refresh_token,
    });
    
    const youtube = google.youtube({
      version: 'v3',
      
      // oauth2Client, apiKey 두가지 사용가능
      // auth: event.apiKey,
      auth: oauth2Client,
    });
    
    // video list 기본 지표 요청 ( api 사용량 1 )
    const videoInfo = await youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: event.media_id,
    });
    const result = videoInfo.data.items[0];
    
    // 재생시간 변환
    const regex = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const match = result.contentDetails.duration.match(regex);
    let playTime;
    if (match) {
      const days = Number(match[1] || 0);
      const hours = Number(match[2] || 0);
      const minutes = Number(match[3] || 0);
      const seconds = Number(match[4] || 0);
      playTime = days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds;
    } else {
      playTime = null;
    }
    
    // 추가 대시보드 지표 람다 요청 처리
    const data = { 
      media_id: event.media_id,
      clientId: event.clientId,
      clientSecret: event.clientSecret,
      redirectUrl: event.redirectUrl,
      apiKey: event.apiKey,
      tokenInfo: event.tokenInfo,
      // userId: event.userId,
      channelId: event.channelId,
      publishedAt: result.snippet.publishedAt, // 추가지표 리포트 시작일자 (ex: "2024-03-05T06:05:09Z")
    };
    const params = {
      FunctionName:
        'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-youtube-request-video-insight',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(data),
    };
    const insight = await lambda.invoke(params).promise();
    
    let share = null;
    let averageViewTime = null;
    let totalViewTime = null;
    let hate = null;
    
    // 에러가 없는 경우만 처리
    if(insight.StatusCode === 200) {
      const obj = JSON.parse(insight.Payload);
      share = obj.body.shares;
      averageViewTime = obj.body.averageViewDuration;
      
      // totalViewTime = obj.body.estimatedMinutesWatched * 0.001;
      totalViewTime = obj.body.estimatedMinutesWatched * 60; // 분 단위이기때문에 초로 변환
      totalViewTime = totalViewTime.toFixed(2);

      hate = obj.body.dislikes;
    }
    
    // 해시태그 처리
    const hashtag = [];
    if (result.snippet.tags) hashtag.push(...result.snippet.tags);
    
    const post = {
      postId: event.media_id,
      userId: event.userId,
      thumbnailUrl: result.snippet.thumbnails.medium.url,
      title: result.snippet.title,
      shortcutUrl: 'https://www.youtube.com/watch?v=' + event.media_id,
      provider: 'youtube',
      media_type: null,
      reach: null,
      view: Number(result.statistics.viewCount),
      like: Number(result.statistics.likeCount),
      // hate: Number(result.statistics.dislikeCount),
      hate: hate,
      comment: Number(result.statistics.commentCount),
      share: share,
      saved: null,
      averageViewTime: averageViewTime,
      totalViewTime: Number(totalViewTime),
      playTime: playTime,
      uploadDate: new Date(result.snippet.publishedAt),
      hashtag: hashtag,
      
      // 계정정보 추가
      youtubeChannelId: event.channelId
    };
    
    const response = {
      statusCode: 200,
      body: post,
    };
    return response;
  
  } catch (error) {
    
    console.error('error =', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
    
  }
};
