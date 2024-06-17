import axios from 'axios';

export const handler = async (event) => {
  try {
    console.info('event =', event);
    
    const fields = [
      'post_id',
      'picture',
      'permalink_url',
      'views',
      'comments.summary(true)',
      'length',
      'created_time',
      'video_insights.metric(total_video_impressions_unique,total_video_reactions_by_type_total,total_video_avg_time_watched,total_video_view_total_time)'
      ];
    const url = `https://graph.facebook.com/v19.0/${event.media_id}?fields=${fields.join(',')}&access_token=${event.access_token}`;
    const result = await axios.get(url);
    
    const obj = result.data;
    
    const reach = obj.video_insights.data.find(item => item.name === 'total_video_impressions_unique');
    const like = obj.video_insights.data.find(item => item.name === 'total_video_reactions_by_type_total');
    
    const averageViewTime = obj.video_insights.data.find(item => item.name === 'total_video_avg_time_watched');
    let averageViewTime1 = 0;
    let averageViewTime2 = 0;
    if (averageViewTime) {
      averageViewTime1 = averageViewTime.values[0].value * 0.001;
      averageViewTime2 = averageViewTime1.toFixed(2);
    }
    
    const totalViewTime = obj.video_insights.data.find(item => item.name === 'total_video_view_total_time');
    let totalViewTime1 = 0;
    let totalViewTime2 = 0;
    if (totalViewTime) {
      totalViewTime1 = totalViewTime.values[0].value * 0.001;
      totalViewTime2 = totalViewTime1.toFixed(2);
    }
      
    // like {} 예외처리
    let likeCheck;
    if (Object.keys(like.values[0].value).length === 0 && like.values[0].value.constructor === Object) {
      likeCheck = 0;
    } else {
      likeCheck = like.values[0].value
    }

    const stories = {
      postId: obj.post_id,
      userId: event.userId,
      thumbnailUrl: obj.picture,
      title: null,
      shortcutUrl: `https://facebook.com/stories/${obj.post_id}`,
      provider: 'facebook',
      media_type: 'stories',
      reach: reach.values[0].value,
      view: obj.views,
      like: likeCheck,
      hate: null,
      comment: obj.comments.summary.total_count,
      share: null,
      saved: null,
      averageViewTime: Number(averageViewTime2),
      totalViewTime: Number(totalViewTime2),
      playTime: obj.length,
      uploadDate: new Date(obj.created_time),
      hashtag: [],
      
      // 계정정보 추가
      facebookPageId: event.id
    };
    
    // TODO implement
    const response = {
      statusCode: 200,
      body: stories,
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
