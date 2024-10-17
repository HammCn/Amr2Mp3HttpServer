const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/') && req.method === 'GET') {
    const url = req.url.split('?')[1];
    const params = new URLSearchParams(url);
    const amrUrl = params.get('url');

    if (!amrUrl) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<center><h1>Bad Request</h1>URL parameter is required</center>');
      return;
    }

    try {
      // 下载 AMR 文件
      const response = await axios({
        method: 'get',
        url: amrUrl,
        responseType: 'stream'
      });

      const tempFileName = Math.random()

      // 创建临时文件路径
      const tempAmrPath = path.join(__dirname, 'temp', tempFileName + '.amr');
      const tempMp3Path = path.join(__dirname, 'temp', tempFileName + '.mp3');

      // 确保临时目录存在
      if (!fs.existsSync(path.dirname(tempAmrPath))) {
        fs.mkdirSync(path.dirname(tempAmrPath), { recursive: true });
      }

      // 将下载的 AMR 文件写入临时文件
      const writer = fs.createWriteStream(tempAmrPath);
      response.data.pipe(writer);

      // 等待文件写入完成
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // 使用 fluent-ffmpeg 进行转换
      ffmpeg(tempAmrPath)
        .output(tempMp3Path)
        .on('end', () => {
          // 读取 MP3 文件并流式输出
          const readStream = fs.createReadStream(tempMp3Path);
          res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
          readStream.pipe(res);

          // 清理临时文件
          readStream.on('close', () => {
            fs.unlink(tempAmrPath, (err) => {
              if (err) console.error(err);
            });
            fs.unlink(tempMp3Path, (err) => {
              if (err) console.error(err);
            });
          });
        })
        .on('error', (err) => {
          console.error(`An error occurred: ${err.message}`);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<center><h1>Convert Error</h1>' + err.message + '</center>');
        })
        .run();
    } catch (error) {
      console.error(`An error occurred: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<center><h1>Download Error</h1>' + error.message + '</center>');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<center><h1>404 Not Found</h1>Amr resource file not found!</center>');
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});