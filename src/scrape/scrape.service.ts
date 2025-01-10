import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();
const WEBHOOK_URL = 'https://play.svix.com/in/e_DMzteFj7im5rZmEAJ58h1Ka2nVR/'; // Webhook yang digunakan

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
        user: process.env.EMAIL_USER,  // Gunakan email Anda yang terdaftar di .env
        pass: process.env.EMAIL_PASSWORD, // Gunakan kata sandi aplikasi dari .e
        //iegyrxnkmfkmskf sufaah96@gmail.com


      },
    });

   

    const mailOptions = {
      from:  process.env.EMAIL_USER, // Ganti dengan email pengirim
      to: process.env.EMAIL_RECEIVER,     // Ganti dengan email penerima
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
      const response = await axios.get(imageUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(`images/${filename}`);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log(`[INFO] Image saved: images/${filename}`);
    } catch (error) {
      console.error(`[ERROR] Failed to save image: ${imageUrl}`);
    }
  }

  // Fungsi untuk mengirimkan data ke webhook
  async sendToWebhook(data: any): Promise<void> {
    try {
      console.log(`[DEBUG] Sending data to webhook: ${JSON.stringify(data)}`);
      await axios.post(WEBHOOK_URL, data, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('[INFO] Data sent to webhook successfully.');
    } catch (error) {
      console.error('[ERROR] Failed to send data to webhook:', error.response?.data || error.message);
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
        console.log('[INFO] Reached 10 posts. Stopping scraping...');
        break;
      }
    }

    return posts.map(post => {
      const payload = { 
        text: post.text, 
        images: post.images.length > 0 ? post.images[0] : "",
        date: post.date,
      };

      if (post.videos.length > 0) {
        console.log(`[INFO] Video found in post: ${post.text || 'No text'} - Video URL: ${post.videos[0]}`);
        this.sendEmail('New Post with Video', `A new post contains a video:\n\nText: ${post.text || 'No text'}\nVideo URL: ${post.videos[0]}`);
      }

      if (post.images.length > 0) {
        const firstImage = post.images[0];
        const filename = `${Date.now()}_${firstImage.split('/').pop()}`;
        this.saveImage(firstImage, filename);
      }

      return payload;
    });
  }

  async scrapeAndSend(url: string): Promise<void> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log('[INFO] Opening browser and setting cookies...');
      await this.loadCookies(context);

      console.log(`[INFO] Navigating to URL: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const posts = await this.scrapePosts(page);

      if (posts.length === 0) {
        console.error('[ERROR] No posts found.');
        return;
      }

      console.log('[INFO] Sending posts to webhook and saving images...');
      for (const { text, images, date } of posts) {
        const payload = { text, images, date };

        await this.sendToWebhook(payload);
      }

      console.log('[SUCCESS] All posts processed.');
    } catch (error) {
      console.error('[ERROR] An error occurred:', error.message);
    } finally {
      console.log('[INFO] Closing browser...');
      await browser.close();
    }
  }
}
