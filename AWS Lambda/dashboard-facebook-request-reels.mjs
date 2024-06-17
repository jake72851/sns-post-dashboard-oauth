import axios from 'axios';
import AWS from 'aws-sdk';
const lambda = new AWS.Lambda();

export const handler = async (event) => {
  try {
    console.info('event =', event);
    
    // 릴스정보 요청
    const fields = [
      'id',
      'post_id',
      // 'thumbnails',
      'picture',
      'description',
      'views',
      'likes.summary(true)',
      'comments.summary(true)',
      'length',
      // 'updated_time',
      'created_time',
      'video_insights.metric(post_impressions_unique,post_video_avg_time_watched,post_video_view_time)'
      ];
    const url = `https://graph.facebook.com/v19.0/${event.id}/video_reels?fields=${fields.join(',')}&access_token=${event.access_token}`;
    let result = await axios.get(url);
    const tempArr1 = [];
    tempArr1.push(...result.data.data);
    while(result.data.paging.next) {
      result = await axios.get(result.data.paging.next);
      tempArr1.push(...result.data.data);
    }
    const reels = tempArr1.map(obj => {
      
      // description 없는 경우 예외처리
      let uniqueHashtags = [];
      if (obj.description) {
        const hashtags = obj.description.match(/#\S+/g);
        uniqueHashtags = [...new Set(hashtags)];
      } 
      
      const reach = obj.video_insights.data.find(item => item.name === 'post_impressions_unique');
      const averageViewTime = obj.video_insights.data.find(item => item.name === 'post_video_avg_time_watched');
      let averageViewTime1 = 0;
      let averageViewTime2 = 0;
      if (averageViewTime) {
        averageViewTime1 = averageViewTime.values[0].value * 0.001;
        averageViewTime2 = averageViewTime1.toFixed(2);
      }
      
      const totalViewTime = obj.video_insights.data.find(item => item.name === 'post_video_view_time');
      let totalViewTime1 = 0;
      let totalViewTime2 = 0;
      if (totalViewTime) {
        totalViewTime1 = totalViewTime.values[0].value * 0.001;
        totalViewTime2 = totalViewTime1.toFixed(2);
      }

      return { 
        postId: obj.post_id,
        userId: event.userId,
        // thumbnailUrl: obj.thumbnails.data,
        thumbnailUrl: obj.picture,
        title: obj.description,
        shortcutUrl: `https://www.facebook.com/reel/${obj.id}`,
        provider: 'facebook',
        media_type: 'reels',
        reach: reach.values[0].value,
        view: obj.views,
        like: obj.likes.summary.total_count,
        hate: null,
        comment: obj.comments.summary.total_count,
        share: null,
        saved: null,
        averageViewTime: Number(averageViewTime2),
        totalViewTime: Number(totalViewTime2),
        playTime: obj.length,
        uploadDate: new Date(obj.created_time),
        hashtag: uniqueHashtags,
        
        // 계정정보 추가
        facebookPageId: event.id
      };
    });
    console.info('reels =', reels);
    
    return {
      statusCode: 200,
      // body: JSON.stringify(reels)
      body: reels,
    };
  } catch (error) {
      console.log(error)
    return {
      statusCode: 500,
      // body: JSON.stringify('Internal Server Error'),
      body: 'Internal Server Error',
    };
  }
};
