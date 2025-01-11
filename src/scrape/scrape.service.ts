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
    console.log('[INFO] Checking for new posts...');

    // Ambil semua elemen artikel di halaman
    const currentPosts = await page.locator('article').evaluateAll((nodes: any[]) =>
      nodes.map((node) => {
        const text = node.innerText || '';
        const images = Array.from(node.querySelectorAll('img') as NodeListOf<HTMLImageElement>)
          .map((img) => img.src)
          .filter((src) => src.startsWith('https://pbs.twimg.com/card_img/')); // Filter gambar yang dimulai dengan 'https://pbs.twimg.com/card_img/'

        // Ambil background images dengan filter yang sesuai
        const backgroundImages = Array.from(node.querySelectorAll('*'))
          .map((element) => {
            const bgImage = window.getComputedStyle(element as Element).getPropertyValue('background-image');
            return bgImage && bgImage !== 'none' ? bgImage.replace(/url\((['"]?)(.*?)\1\)/, '$2') : null;
          })
          .filter((bg) => bg && bg.startsWith('https://pbs.twimg.com/card_img/')); // Filter background images sesuai

        const videoElements = node.querySelectorAll('video');
        const videos = Array.from(videoElements).map((video: HTMLVideoElement) => video.src).filter(Boolean);

        const dateElement = node.querySelector('time');
        const date = dateElement ? dateElement.getAttribute('datetime') : null;

        return { text, images, backgroundImages, date, videos };
      })
    );

    // Loop untuk cek apakah ada posting baru
    for (const post of currentPosts) {
      const postId = post.text + post.images.join(',') + post.backgroundImages.join(',') + post.videos.join(',');

      // Membuat URL tweet berdasarkan informasi yang ada (misalnya, ID tweet atau bagian dari teks)
     // const tweetUrl = `https://x.com/${post.username}/status/${postId}`;
      const tweetUrl = `https://x.com/CoinDesk/status/${postId}`;

      // Cek apakah posting ini sudah dilihat sebelumnya
      if (!this.seenPosts.has(postId)) {
        console.log('[INFO] Found a new post:');
        console.log(`[INFO] Text: ${post.text}`);
        console.log(`[INFO] Images: ${post.images}`);
        console.log(`[INFO] Background Images: ${post.backgroundImages}`);
        console.log(`[INFO] Videos: ${post.videos}`);
        console.log(`[INFO] Date: ${post.date}`);
        console.log(`[INFO] Tweet URL: ${tweetUrl}`); // Menampilkan URL tweet

        // Tandai sebagai sudah dilihat
        this.seenPosts.add(postId);

        // Proses posting baru
        if (post.images.length > 0) {
          const firstImage = post.images[0];
          const filename = `${Date.now()}_${firstImage.split('/').pop()}`;
          await saveImage(firstImage, filename); // Simpan gambar
        }

        // Kirim data ke Telegram
        const telegramMessage = `New Post:\n\n*Text:* ${post.text || 'No text'}\n*Date:* ${post.date || 'No date'}\n*Tweet URL:* ${tweetUrl}`;
        await sendToTelegramChannel(telegramMessage);

        // Kirim data ke database
        const payload = {
          text: post.text,
          images: post.images.length > 0 ? post.images[0] : '',
          date: post.date,
          username: 'coindesk',
          link_tweet: tweetUrl, // Simpan URL tweet
        };
        await sendTodbPostgre(payload);

        if (post.videos.length > 0) {
          await sendEmail('New Post with Video', `A new post contains a video:\n\nText: ${post.text || 'No text'}\nVideo URL: ${post.videos[0]}`);
        }

        // Anda bisa menambahkan logika lain di sini (misalnya kirim email)

        return; // Keluar setelah menemukan dan memproses posting baru
      }
    }


    console.log('[INFO] No new posts found.');
  }






  @Cron('*/1 * * * *') // Menjadwalkan setiap 1 menit
  async scrapePeriodically() {
    console.log('[INFO] Running periodic scraping task...');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://x.com/coindesk');
    await this.scrapePostsAndCheckNew(page);

    await browser.close();
  }

}
