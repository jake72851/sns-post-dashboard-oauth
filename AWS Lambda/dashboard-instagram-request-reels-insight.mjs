import axios from 'axios';

export const handler = async (event) => {
  try {
    
    const fields = [
      'id',
      'thumbnail_url',
      'caption',
      'permalink',
      'like_count',
      'comments_count',
      'timestamp',
      'insights.metric(reach,plays,ig_reels_aggregated_all_plays_count,shares,saved,ig_reels_avg_watch_time,ig_reels_video_view_total_time)'
      ];
    const url = `https://graph.facebook.com/v19.0/${event.media_id}?fields=${fields.join(',')}&access_token=${event.access_token}`;
    const result = await axios.get(url);
    
    const obj = result.data;
    
    const reach = obj.insights.data.find(item => item.name === 'reach');
    // const view = obj.insights.data.find(item => item.name === 'plays');
    const view = obj.insights.data.find(item => item.name === 'ig_reels_aggregated_all_plays_count');
    const share = obj.insights.data.find(item => item.name === 'shares');
    const saved = obj.insights.data.find(item => item.name === 'saved');
    
    const averageViewTime = obj.insights.data.find(item => item.name === 'ig_reels_avg_watch_time');
    const averageViewTime1 = averageViewTime.values[0].value * 0.001;
    const averageViewTime2 = averageViewTime1.toFixed(2);
      
    const totalViewTime = obj.insights.data.find(item => item.name === 'ig_reels_video_view_total_time');
    const totalViewTime1 = totalViewTime.values[0].value * 0.001;
    const totalViewTime2 = totalViewTime1.toFixed(2);
      
    // 해시태그 처리
    const hashtags = obj.caption.match(/#\S+/g);
    const uniqueHashtags = [...new Set(hashtags)];
    
    const reels = {
      postId: obj.id,
      userId: event.userId,
      thumbnailUrl: obj.thumbnail_url,
      title: obj.caption,
      shortcutUrl: obj.permalink,
      provider: 'instagram',
      media_type: 'reels',
      reach: reach.values[0].value,
      view: view.values[0].value,
      like: obj.like_count,
      hate: null,
      comment: obj.comments_count,
      share: share.values[0].value,
      saved: saved.values[0].value,
      averageViewTime: Number(averageViewTime2),
      totalViewTime: Number(totalViewTime2),
      playTime: null,
      uploadDate: new Date(obj.timestamp),
      hashtag: uniqueHashtags,
      
      // 계정정보 추가
      instagramAccountId: event.id
    };
    
    // TODO implement
    const response = {
      statusCode: 200,
      body: reels,
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
