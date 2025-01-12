import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import { saveImage, sendToTelegramChannel, sendEmail, sendTodbPostgre } from '../utils/helpers';
import { Cron } from '@nestjs/schedule';
import { loadCookies } from '../utils/loadCookies';  // Import fungsi loadCookies
import { Page } from 'playwright';

@Injectable()
export class ScrapeService {
  private lastCheckedTimestamp: number = Date.now();  // Properti untuk menyimpan timestamp pengecekan terakhir
  private seenPosts: Set<string> = new Set(); // Tambahkan properti ini

  constructor() { }

  // Fungsi untuk meng-scrape post

  // Fungsi untuk meng-scrape post
  async scrapePosts(page: any): Promise<any[]> {
    const posts = [];
    const seenPosts = new Set();

    console.log('[INFO] Fetching posts...');
    let lastHeight = 0;
    let retries = 0;
    const MAX_RETRIES = 10;

    while (retries < MAX_RETRIES) {
      const newPosts = await page.locator('article').evaluateAll((nodes: any[]) =>
        nodes.map((node) => {
          const text = node.innerText || '';
          const images = Array.from(node.querySelectorAll('img') as NodeListOf<HTMLImageElement>)
            .map((img) => img.src)
            .filter((src) => src.startsWith('https://pbs.twimg.com/card_img/'));
          const backgroundImages = Array.from(node.querySelectorAll('*'))
            .map((element) => {
              const bgImage = window.getComputedStyle(element as Element).getPropertyValue('background-image');
              return bgImage && bgImage !== 'none' ? bgImage.replace(/url\((['"]?)(.*?)\1\)/, '$2') : null;
            })
            .filter((bg) => bg);
          const videoElements = node.querySelectorAll('video');
          const videos = Array.from(videoElements).map((video: HTMLVideoElement) => video.src).filter(Boolean);
          const dateElement = node.querySelector('time');
          const date = dateElement ? dateElement.getAttribute('datetime') : null;

          const linkElement = node.querySelector('a[href*="/status/"]');
          const linkTweet = linkElement ? linkElement.href : null;

          return { text, images, backgroundImages, date, videos, linkTweet };
        })
      );

      console.log(`[INFO] Found ${newPosts.length} posts on this scroll.`);

      for (const post of newPosts) {
        const postId = post.text + post.images.join(',') + post.backgroundImages.join(',') + post.videos.join(',');
        if (!seenPosts.has(postId)) {
          seenPosts.add(postId);
          posts.push(post);
        }
      }

      console.log(`[INFO] Total unique posts so far: ${posts.length}`);

      // Scroll the page to load more posts
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000); // Wait for content to load

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      console.log(`[INFO] Current height: ${currentHeight}, Last height: ${lastHeight}`);

      if (currentHeight === lastHeight) {
        retries++;
        console.log(`[INFO] No new posts. Retry ${retries}/${MAX_RETRIES}.`);
      } else {
        retries = 0;  // Reset retries if new posts are found
      }

      lastHeight = currentHeight;

      if (retries >= MAX_RETRIES) {
        console.log('[INFO] No new posts found after multiple retries. Stopping...');
        break;
      }
    }

    // Process all the found posts
    for (const post of posts) {
      const payload = {
        text: post.text,
        images: post.images.length > 0 ? post.images[0] : '',
        date: post.date,
        username: 'coindesk',
        link_tweet: post.linkTweet,
      };

      // Send the post data to the database


      if (post.videos.length > 0) {
        const telegramMessage = `📹 *New Post with Video*\n\n*Text:* ${post.text || 'No text'}\n*Video URL:* ${post.videos[0]}`;
        await sendToTelegramChannel(telegramMessage);
      }

      // Handle image posts
      if (post.images.length > 0) {
        const firstImage = post.images[0];
        const filename = `${Date.now()}_${firstImage.split('/').pop()}`;
        await saveImage(firstImage, filename);
      }

      // Send the post data to the database
      await sendTodbPostgre(payload);

      // Optionally send an email if necessary (for example, for video posts)
      if (post.videos.length > 0) {
        await sendEmail('New Post with Video', `A new post contains a video:\n\nText: ${post.text || 'No text'}\nVideo URL: ${post.videos[0]}`);
      }


    }

    return posts;
  }


  // Fungsi untuk scrape dan kirim data
  async scrapeAndSend(): Promise<void> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const username = 'coindesk';

    try {
      const url = `https://x.com/${username}`;
      console.log(`[INFO] Navigating to URL: ${url}`);

      console.log('[INFO] Opening browser and setting cookies...');

      await loadCookies(context);


      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Menjalankan proses scrape
      await page.waitForTimeout(2000); // Menunggu 2 detik untuk menghindari pembatasan scraping

      await this.scrapePosts(page);

      console.log('[SUCCESS] All posts processed.');
    } catch (error) {
      console.error('[ERROR] An error occurred:', error.message);
    } finally {
      console.log('[INFO] Closing browser...');
      await browser.close();
    }
  }

  // Fungsi untuk memeriksa dan menyaring postingan baru

  async scrapePostsAndCheckNew(page: Page): Promise<void> {
    console.log('[INFO] Scraping tweets...');

    // Tunggu hingga gambar dimuat
    await page.waitForSelector('a[href*="/status/"]', { timeout: 10000 });

    // Scrape tweets dan simpan dalam array
    const scrapedTweets = await page.locator('article').evaluateAll((nodes) => {
      return nodes.map((node) => {
        const text = node.textContent || '';

        // Ambil link foto dari <a href="/CoinDesk/status/{id_status}/photo/1">
        const linkTweet = (node.querySelector('a[href*="/status/"]') as HTMLAnchorElement)?.href || null;

        // Ambil gambar dari <img> dan background-image dari div
        const images: string[] = [];
        const imgElements = node.querySelectorAll('img[src^="https://pbs.twimg.com/media/"]');
        imgElements.forEach((img) => {
          images.push((img as HTMLImageElement).src);
        });

        const backgroundImages = Array.from(node.querySelectorAll<HTMLElement>('*'))
          .map((element) => {
            const bgImage = window.getComputedStyle(element).getPropertyValue('background-image');
            return bgImage.startsWith('url("https://pbs.twimg.com/media/")')
              ? bgImage.replace(/url\((['"]?)(.*?)\1\)/, '$2')
              : null;
          })
          .filter((bg): bg is string => !!bg);

        const allImages = [...images, ...backgroundImages];

        const date = node.querySelector('time')?.getAttribute('datetime') || null;

        return { text, images: allImages, date, linkTweet };
      });
    });

    console.log('[DEBUG] Scraped Tweets:', scrapedTweets);

    // Filter tweet berdasarkan waktu (1 jam terakhir)
    const fourHoursAgo = new Date().getTime() - 1 * 60 * 60 * 1000;
    const recentTweets = scrapedTweets.filter((tweet) => {
      if (!tweet.date) return false;
      const tweetDate = new Date(tweet.date).getTime();
      return tweetDate >= fourHoursAgo;
    });

    console.log('[DEBUG] Filtered recent tweets:', recentTweets);

    // Kirimkan data tweet satu per satu
    for (const tweet of recentTweets) {
      console.log('[INFO] Sending tweet to the webhook...');
      await sendTodbPostgre({
        text: tweet.text,
        images: tweet.images.length > 0 ? tweet.images[0] : '',
        date: tweet.date,
        username: 'coindesk',
        link_tweet: tweet.linkTweet,
      });

      // Send the post to Telegram if necessary
      await sendToTelegramChannel(`New Tweet: ${tweet.text}`);

      // Handle images
      if (tweet.images.length > 0) {
        const firstImage = tweet.images[0];
        const filename = `${Date.now()}_${firstImage.split('/').pop()}`;
        await saveImage(firstImage, filename);
      }

      // Optionally send email for video posts
      if (tweet.images.length > 0) {
        await sendEmail('New Post with Image', `A new post contains an image:\n\nText: ${tweet.text || 'No text'}\nImage URL: ${tweet.images[0]}`);
      }
    }

    if (recentTweets.length === 0) {
      console.log('[INFO] No new tweets found within the last 1 hours.');
    }
  }


  //@Cron('*/1 * * * *') // Menjadwalkan setiap 1 menit
  @Cron('0 */1 * * *') // Menjadwalkan setiap 2 jam
  async scrapePeriodically() {
    console.log('[INFO] Running periodic scraping task...');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://x.com/coindesk');
    await this.scrapePostsAndCheckNew(page);

    await browser.close();
  }

}