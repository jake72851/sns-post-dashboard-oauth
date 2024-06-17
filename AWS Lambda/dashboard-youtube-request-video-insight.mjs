import { google } from 'googleapis';
import moment from 'moment';

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
    
    const youtubeAnalytics = google.youtubeAnalytics({
      version: 'v2',
      // auth: event.apiKey, // apiKey로는 불가능한듯
      auth: oauth2Client,
    });
    
    // metrics
    const metrics = [
      'averageViewDuration',
      'estimatedMinutesWatched',
      'shares',
      'dislikes'
    ];
    
    // 지표 요청 ( api 사용량 1 )
    const videoInfo = await youtubeAnalytics.reports.query({
      ids: `channel==${event.channelId}`,
      startDate: moment(event.publishedAt).format('YYYY-MM-DD'),
      endDate: moment().format('YYYY-MM-DD'),
      metrics: metrics.join(','),
      filters: `video==${event.media_id}`,
    });
    const rows = videoInfo.data.rows[0];
    const columnHeaders = videoInfo.data.columnHeaders;
    
    const response = {};
    for(let i = 0; i < columnHeaders.length; i++) {
      response[columnHeaders[i].name] = rows[i];
    }

    return {
      statusCode: 200,
      body: response,
    };
  
  } catch (error) {
    
    console.error('error =', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
    
  }
};
