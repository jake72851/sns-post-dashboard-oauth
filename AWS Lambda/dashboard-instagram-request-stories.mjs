import axios from 'axios';

export const handler = async (event) => {
  try {
    
    // 스토리 정보 요청
    const fields = [
      'id',
      'media_type',
      'thumbnail_url',
      'caption',
      'permalink',
      'like_count',
      'comments_count',
      'timestamp',
      'insights.metric(reach,impressions,shares,saved)'
      ];
    const url = `https://graph.facebook.com/v19.0/${event.instagram_business_account.id}/stories?fields=${fields.join(',')}&access_token=${event.tokenInfo.access_token}`;
    let result = await axios.get(url);
    const tempArr = [];
    tempArr.push(...result.data.data);

    while(result.data.paging.next) {
      result = await axios.get(result.data.paging.next);
      tempArr.push(...result.data.data);
    }
    
    // media_type 이 VIDEO 인 경우만 추출
    const videos = tempArr.filter(item => item.media_type === 'VIDEO');
    
    const stories = videos.map(obj => {
      const hashtags = obj.caption.match(/#\S+/g);
      const uniqueHashtags = [...new Set(hashtags)];

      const reach = obj.insights.data.find(item => item.name === 'reach');
      const view = obj.insights.data.find(item => item.name === 'impressions');
      const share = obj.insights.data.find(item => item.name === 'shares');

      let shareResult = 0
      if(share) shareResult = share;
      const saved = obj.insights.data.find(item => item.name === 'saved');

      return { 
        postId: obj.id,
        userId: event.userId,
        thumbnailUrl: obj.thumbnail_url,
        title: obj.caption,
        shortcutUrl: obj.permalink,
        provider: 'instagram',
        media_type: 'stories',
        reach: reach.values[0].value,
        view: view.values[0].value,
        like: obj.like_count,
        hate: null,
        comment: obj.comments_count,
        share: shareResult,
        saved: saved.values[0].value,
        averageViewTime: null,
        totalViewTime: null,
        playTime: null,
        uploadDate: new Date(obj.timestamp),
        hashtag: uniqueHashtags,
        
        // 계정정보 추가
        instagramAccountId: event.instagram_business_account.id
      };
    });
    
    return {
      statusCode: 200,
      // body: JSON.stringify(reels)
      body: stories,
    };
  } catch (error) {
    return {
      statusCode: 500,
      // body: JSON.stringify('Internal Server Error'),
      body: 'Internal Server Error',
    };
  }
};
