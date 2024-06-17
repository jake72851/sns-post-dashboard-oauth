import axios from 'axios';

export const handler = async (event) => {
  try {
    
    const requestListNumber = 20;
    
    // 릴스정보 요청
    const fields = [
      'id',
      'cover_image_url',
      'title',
      'share_url',
      'view_count',
      'like_count',
      'comment_count',
      'share_count',
      'duration',
      'create_time'
    ];
    const data = {
      max_count: requestListNumber
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${event.access_token}`
    };
    const url = `https://open.tiktokapis.com/v2/video/list/?fields=${fields.join(',')}`;
    const result = await axios.post(url, data, {headers} );
    
    const resData = [...result.data.data.videos];
    
    let has_more = result.data.data.has_more;
    let cursor = result.data.data.cursor;
    while(has_more) {
      const fields = [
        'id',
        'cover_image_url',
        'title',
        'share_url',
        'view_count',
        'like_count',
        'comment_count',
        'share_count',
        'duration',
        'create_time'
      ];
      const data = {
        max_count: requestListNumber,
        cursor: cursor
      };
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${event.access_token}`
      };
      const url = `https://open.tiktokapis.com/v2/video/list/?fields=${fields.join(',')}`;
      const result = await axios.post(url, data, {headers} );
      resData.push(...result.data.data.videos);
      has_more = result.data.data.has_more;
    }
    
    const totalData = resData.map(obj => {
      const hashtags = obj.title.match(/#\S+/g);
      const uniqueHashtags = [...new Set(hashtags)];
      return { 
        postId: obj.id,
        userId: event.userId,
        thumbnailUrl: obj.cover_image_url,
        title: obj.title,
        shortcutUrl: obj.share_url,
        provider: 'tiktok',
        media_type: null,
        reach: null,
        view: obj.view_count,
        like: obj.like_count,
        hate: null,
        comment: obj.comment_count,
        share: obj.share_count,
        saved: null,
        averageViewTime: null,
        totalViewTime: null,
        playTime: obj.duration,
        uploadDate: new Date(obj.create_time * 1000),
        hashtag: uniqueHashtags,
        
        // 계정정보 추가
        tiktokAccountId: event.open_id
      };
    });
    
    const response = {
      statusCode: 200,
      body: totalData,
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
