const fs = require('fs');
const axios = require('axios');
const { chromium } = require('playwright');

// Fungsi untuk mengirimkan data ke webhook
async function sendToWebhook(data) {
  try {
    const response = await axios.post('https://play.svix.com/in/e_DMzteFj7im5rZmEAJ58h1Ka2nVR', data, {
      headers: {
        'Content-Type': 'application/json', // Menambahkan header Content-Type
      },
    });
    console.log('[INFO] Data sent successfully:', response.data);
  } catch (error) {
    console.error('[ERROR] Failed to send data:', error.response ? error.response.data : error.message);
  }
}

// Fungsi untuk memuat cookies dan menggunakannya
async function loadCookies(page) {
  try {
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    await page.context().addCookies(cookies);
    console.log('[INFO] Cookies loaded successfully.');
  } catch (error) {
    console.error('[ERROR] Failed to load cookies:', error);
  }
}

// Fungsi untuk melakukan scraping tweet
const scrapeTweets = async (page) => {
  console.log('[INFO] Scraping tweets...');

  // Tunggu hingga gambar dimuat
  await page.waitForSelector('a[href*="/status/"]', { timeout: 10000 }); // Tunggu hingga link ke status tersedia

  // Scrape tweets dan simpan dalam array
  const scrapedTweets = await page.locator('article').evaluateAll((nodes) => {
    return nodes.map((node) => {
      const text = node.innerText || '';

      // Ambil link foto dari <a href="/CoinDesk/status/{id_status}/photo/1">
      const linkTweet = node.querySelector('a[href*="/status/"]')
        ? node.querySelector('a[href*="/status/"]').href
        : null;

      // Ambil gambar dari <img> dan background-image dari div
      const images = [];
      const imgElements = node.querySelectorAll(
        'img[src^="https://pbs.twimg.com/media/"]',
      );
      imgElements.forEach((img) => {
        images.push(img.src);
      });

      const backgroundImages = Array.from(node.querySelectorAll('*'))
        .map((element) => {
          const bgImage = window
            .getComputedStyle(element)
            .getPropertyValue('background-image');
          return bgImage &&
            bgImage.startsWith('url("https://pbs.twimg.com/media/')
            ? bgImage.replace(/url\((['"]?)(.*?)\1\)/, '$2')
            : null;
        })
        .filter((bg) => bg); // Filter gambar latar belakang

      // Gabungkan gambar yang ditemukan
      const allImages = [...images, ...backgroundImages];

      const date = node.querySelector('time')
        ? node.querySelector('time').getAttribute('datetime')
        : null;

      return { text, images: allImages, date, linkTweet };
    });
  });

  console.log('[DEBUG] Scraped Tweets:', scrapedTweets); // Debugging seluruh tweet yang diambil

  // Filter tweet berdasarkan waktu (4 jam terakhir)
  const fourHoursAgo = new Date().getTime() - 4 * 60 * 60 * 1000;
  const recentTweets = scrapedTweets.filter((tweet) => {
    const tweetDate = new Date(tweet.date).getTime();
    return tweetDate >= fourHoursAgo;
  });

  console.log('[DEBUG] Filtered recent tweets:', recentTweets); // Debugging tweet yang sudah difilter

  // Kirimkan data tweet satu per satu
  for (const tweet of recentTweets) {
    console.log('[INFO] Sending tweet to the webhook...');
    await sendToWebhook({
      text: tweet.text,
      images: tweet.images.length > 0 ? tweet.images[0] : '', // Kirim gambar pertama jika ada, jika tidak kirim string kosong
      date: tweet.date,
      username: 'coindesk', // Misalnya, username Anda bisa diambil dari halaman atau dari tweet
      link_tweet: tweet.linkTweet,
    }); // Mengirimkan tweet satu per satu
  }

  if (recentTweets.length === 0) {
    console.log('[INFO] No new tweets found within the last 4 hours.');
  }
};

// Main process
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Memuat cookies sebelum mengakses halaman
  await loadCookies(page);

  // Akses halaman setelah cookies dimuat
  await page.goto('https://x.com/CoinDesk');

  // Tunggu beberapa waktu agar halaman dapat memuat
  await page.waitForTimeout(10000); // Tunggu 10 detik atau sesuaikan dengan kebutuhan

  // Panggil fungsi scrape
  await scrapeTweets(page);

  // Tutup browser setelah selesai
  await browser.close();
})();
