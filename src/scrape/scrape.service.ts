import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

const WEBHOOK_URL = 'http://localhost:3000/posts';

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
      // Ensure the 'images' directory exists
      if (!fs.existsSync('images')) {
        fs.mkdirSync('images');
      }
  
      // Clean up the filename (remove invalid characters)
      const cleanedFilename = filename.replace(/[<>:"/\\|?*]+/g, '_'); // Sanitize filename
  
      // Ensure the filename ends with .jpg
      const finalFilename = `${cleanedFilename}.jpg`;
  
      // Ensure file is saved with the correct filename
      const filePath = `images/${finalFilename}`;
  
      // If the URL contains query parameters, extract the file name without them
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
        console.log('[INFO] Reached 40 posts. Stopping scraping...');
        break;
      }
    }

    // Mengirimkan data dan menyimpan gambar satu per satu
    for (const post of posts) {
      const payload = {
        text: post.text,
        images: post.images.length > 0 ? post.images[0] : "",
        date: post.date,
      };

      // Jika ada video, kirim email
      if (post.videos.length > 0) {
        console.log(`[INFO] Video found in post: ${post.text || 'No text'} - Video URL: ${post.videos[0]}`);
        this.sendEmail('New Post with Video', `A new post contains a video:\n\nText: ${post.text || 'No text'}\nVideo URL: ${post.videos[0]}`);
      }

      // Jika ada gambar, simpan gambar dan kirim data ke webhook
      if (post.images.length > 0) {
        const firstImage = post.images[0];
        const filename = `${Date.now()}_${firstImage.split('/').pop()}`;
        await this.saveImage(firstImage, filename);  // Menyimpan gambar
      }

      await this.sendToWebhook(payload);  // Mengirim data ke webhook
    }

    return posts;
  }

  async scrapeAndSend(username: string): Promise<void> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
  
    try {
      // Menentukan URL berdasarkan username
      const url = `https://x.com/${username}`;
      console.log(`[INFO] Navigating to URL: ${url}`);
  
      console.log('[INFO] Opening browser and setting cookies...');
      await this.loadCookies(context);
  
      // Navigasi ke URL
      await page.goto(url, { waitUntil: 'domcontentloaded' });
  
      const posts = await this.scrapePosts(page);
  
      if (posts.length === 0) {
        console.error('[ERROR] No posts found.');
        return;
      }
  
      console.log('[INFO] Sending posts to webhook and saving images...');
      for (const { text, images, date } of posts) {
        // Menyusun payload dengan username
        const payload = {
          text,
          images: images || "",  // Pastikan images memiliki nilai default jika tidak ada gambar
          date,
          username,  // Mengganti 'input' menjadi 'username'
        };
  
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
