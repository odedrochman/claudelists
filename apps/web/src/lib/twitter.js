import { TwitterApi } from 'twitter-api-v2';

export async function postTweet(text) {
  const userClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  const result = await userClient.v2.tweet(text);
  const tweetId = result.data.id;
  const me = await userClient.v2.me();
  const url = `https://x.com/${me.data.username}/status/${tweetId}`;

  return { id: tweetId, url, username: me.data.username };
}
