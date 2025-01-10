import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { chromium } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

const DATABASE_POST = 'http://localhost:3000/posts';

@Injectable()
export class ScrapeService {
  // Fungsi untuk memuat cookies
  async loadCookies(context: any): Promise<void> {
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    await context.addCookies(cookies);
  }

  // Fungsi untuk mengirimkan email
  async sendEmail(subject: string, text: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_RECEIVER,
      subject: subject,
      text: text,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('[INFO] Email sent successfully.');
    } catch (error) {
      console.error('[ERROR] Failed to send email:', error);
    }
  }

  // Fungsi untuk menyimpan gambar
  async saveImage(imageUrl: string, filename: string): Promise<void> {
    try {
      if (!fs.existsSync('images')) {
        fs.mkdirSync('images');
      }

      const cleanedFilename = filename.replace(/[<>:"/\\|?*]+/g, '_');
      const finalFilename = `${cleanedFilename}.jpg`;
      const filePath = `images/${finalFilename}`;

      const response = await axios.get(imageUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`[INFO] Image saved: ${filePath}`);
    } catch (error) {
      console.error(`[ERROR] Failed to save image: ${imageUrl}`, error.message);
    }
  }

  // Fungsi untuk mengirimkan data ke daabase
  async sendTodbPostgre(data: any): Promise<void> {
    try {
      console.log(`[DEBUG] Sending data to database: ${JSON.stringify(data)}`);
      await axios.post(DATABASE_POST, data, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('[INFO] Data sent to daabase successfully.');
    } catch (error) {
      console.error('[ERROR] Failed to send data to daabase:', error.response?.data || error.message);
    }
  }

  // Fungsi untuk meng-scrape post
  async scrapePosts(page: any): Promise<any[]> {
    const posts = [];
    const seenPosts = new Set();

    console.log('[INFO] Fetching posts...');
    let lastHeight = 0;
    let retries = 0;

    while (retries < 3 && posts.length < 40) {
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

          return { text, images, backgroundImages, date, videos };
        })
      );

      for (const post of newPosts) {
        const postId = post.text + post.images.join(',') + post.backgroundImages.join(',') + post.videos.join(',');
        if (!seenPosts.has(postId)) {
          seenPosts.add(postId);
          posts.push(post);
          if (posts.length >= 40) {
            break;
          }
        }
      }

      console.log(`[INFO] Found ${posts.length} unique posts.`);

      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(Math.random() * 2000 + 1000);

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === lastHeight) {
        retries++;
        console.log(`[INFO] No new posts. Retry ${retries}/3.`);
      } else {
        retries = 0;
      }
      lastHeight = currentHeight;

      if (posts.length >= 40) {
        console.log('[INFO] Reached 40 posts. Stopping scraping...');
        break;
      }
    }

    for (const post of posts) {
      const payload = {
        text: post.text,
        images: post.images.length > 0 ? post.images[0] : '',
        date: post.date,
      };

      if (post.videos.length > 0) {
        console.log(`[INFO] Video found in post: ${post.text || 'No text'} - Video URL: ${post.videos[0]}`);
        this.sendEmail('New Post with Video', `A new post contains a video:\n\nText: ${post.text || 'No text'}\nVideo URL: ${post.videos[0]}`);
      }

      if (post.images.length > 0) {
        const firstImage = post.images[0];
        const filename = `${Date.now()}_${firstImage.split('/').pop()}`;
        await this.saveImage(firstImage, filename);
      }

      await this.sendTodbPostgre(payload);
    }

    return posts;
  }

  async scrapeAndSend(username: string): Promise<void> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const url = `https://x.com/${username}`;
      console.log(`[INFO] Navigating to URL: ${url}`);

      console.log('[INFO] Opening browser and setting cookies...');
      await this.loadCookies(context);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      await this.scrapePosts(page);

      console.log('[SUCCESS] All posts processed.');
    } catch (error) {
      console.error('[ERROR] An error occurred:', error.message);
    } finally {
      console.log('[INFO] Closing browser...');
      await browser.close();
    }
  }

  @Cron('0 * * * *') // Menjalankan setiap jam
  async scrapePeriodically(): Promise<void> {
    const username = 'coindesk'; // Ganti dengan username target
    console.log(`[INFO] Running periodic scrape for ${username}`);
    await this.scrapeAndSend(username);
  }
}
