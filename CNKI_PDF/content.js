// 等待页面加载完成
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.hostname.includes('cnki.net')) {
      addPdfDownloadButtons();
      addHoverForAbstracts();
      addDownloadAllButton();
  }
});

// 监听动态加载的内容
const observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
          addPdfDownloadButtons();
          addHoverForAbstracts();
          addDownloadAllButton();
      }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 添加PDF下载按钮（保持原有功能）
async function addPdfDownloadButtons() {
  const articleLinks = document.querySelectorAll('#gridTable > div > div > div > table > tbody > tr > td.name > a.fz14, #gridTable > div > div > div > table > tbody > tr > td.name > div > a.fz14');

  for (const link of articleLinks) {
      const row = link.closest('tr');
      if (!row || row.querySelector('.pdf-download-btn')) continue;

      // 创建下载按钮
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'pdf-download-btn';
      downloadBtn.textContent = '下载PDF';
      Object.assign(downloadBtn.style, {
          marginLeft: '10px',
          padding: '2px 5px',
          fontSize: '12px',
          cursor: 'pointer'
      });

      // 添加到页面
      const nameCell = row.querySelector('td.name');
      if (nameCell) nameCell.appendChild(downloadBtn);

      // 点击事件
      downloadBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          downloadBtn.textContent = '获取中...';
          downloadBtn.disabled = true;

          try {
              const pdfUrl = await fetchPdfUrl(link.href);
              pdfUrl ? window.open(pdfUrl, '_blank') : alert('无法获取PDF下载链接');
          } catch (error) {
              console.error('获取PDF链接失败:', error);
              alert('获取PDF链接失败: ' + error.message);
          } finally {
              downloadBtn.textContent = '下载PDF';
              downloadBtn.disabled = false;
          }
      });
  }
}

// 新增功能：为文章标题添加悬停显示摘要
async function addHoverForAbstracts() {
  const articleLinks = document.querySelectorAll('#gridTable > div > div > div > table > tbody > tr > td.name > a.fz14, #gridTable > div > div > div > table > tbody > tr > td.name > div > a.fz14');

  for (const link of articleLinks) {
      if (link.dataset.abstractAdded) continue;
      link.dataset.abstractAdded = true;

      // 创建悬停提示框
      const tooltip = document.createElement('div');
      tooltip.className = 'cnki-abstract-tooltip';
      Object.assign(tooltip.style, {
          position: 'fixed',
          maxWidth: '400px',
          padding: '10px',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: '9999',
          display: 'none',
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#333'
      });
      document.body.appendChild(tooltip);

      // 鼠标悬停事件
      link.addEventListener('mouseenter', async (e) => {
          const rect = link.getBoundingClientRect();
          tooltip.style.left = `${rect.right + 10}px`;
          tooltip.style.top = `${rect.top}px`;
          tooltip.style.display = 'block';
          tooltip.textContent = '加载摘要中...';

          try {
              const abstract = await fetchAbstract(link.href);
              tooltip.innerHTML = abstract || '<span style="color:#999">无摘要内容</span>';
          } catch (error) {
              console.error('获取摘要失败:', error);
              tooltip.innerHTML = '<span style="color:red">获取摘要失败</span>';
          }
      });

      link.addEventListener('mouseleave', () => {
          tooltip.style.display = 'none';
      });
  }
}

// 获取摘要内容
async function fetchAbstract(articleUrl) {
  try {
      const response = await fetch(articleUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('网络响应不正常');

      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      // 获取摘要内容
      const abstractElement = doc.querySelector('#ChDivSummary');
      return abstractElement ? abstractElement.textContent.trim() : null;
  } catch (error) {
      console.error('获取摘要时出错:', error);
      throw error;
  }
}

// 获取PDF下载链接（保持不变）
async function fetchPdfUrl(articleUrl) {
  try {
      const response = await fetch(articleUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('网络响应不正常');

      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      
      // 获取所有下载链接
      const downloadLinks = doc.querySelectorAll('#pdfDown, #cajDown');
      
      // 遍历所有下载链接，找到PDF下载按钮
      for (const link of downloadLinks) {
          const linkText = link.textContent.trim().toLowerCase();
          if (linkText.includes('pdf')) {
              return link.href;
          }
      }
      return null;
  } catch (error) {
      console.error('获取PDF链接时出错:', error);
      throw error;
  }
}

// 添加下载所有按钮
function addDownloadAllButton() {
  const pagesDiv = document.querySelector('#briefBox > div:nth-child(2) > div > div.pages');
  if (pagesDiv && !pagesDiv.querySelector('.download-all-btn')) {
      const downloadAllBtn = document.createElement('button');
      downloadAllBtn.className = 'download-all-btn';
      downloadAllBtn.textContent = '下载所有PDF';
      pagesDiv.appendChild(downloadAllBtn);

      downloadAllBtn.addEventListener('click', async () => {
          try {
              await downloadAllPdfs();
          } catch (error) {
              console.error('下载所有PDF时出错:', error);
              alert('下载所有PDF时出错: ' + error.message);
          }
      });
  }
}

// 下载队列管理类
class DownloadQueue {
    constructor(maxConcurrent = 3) {
        this.queue = [];
        this.running = 0;
        this.maxConcurrent = maxConcurrent;
        this.totalTasks = 0;
        this.completedTasks = 0;
        this.failedTasks = 0;
    }

    async add(task) {
        this.totalTasks++;
        this.queue.push(task);
        await this.processQueue();
    }

    async processQueue() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) return;

        const task = this.queue.shift();
        this.running++;

        try {
            await this.executeTask(task);
            this.completedTasks++;
        } catch (error) {
            console.error('任务执行失败:', error);
            this.failedTasks++;
            if (task.retries < 3) {
                task.retries++;
                this.queue.push(task);
            }
        } finally {
            this.running--;
            this.updateProgress();
            await this.processQueue();
        }
    }

    async executeTask(task) {
        const delay = Math.random() * 2000 + 1000; // 1-3秒随机延迟
        await new Promise(resolve => setTimeout(resolve, delay));
        await task.execute();
    }

    updateProgress() {
        const progressElement = document.querySelector('.download-progress');
        if (progressElement) {
            const progress = ((this.completedTasks / this.totalTasks) * 100).toFixed(1);
            progressElement.textContent = `下载进度: ${progress}% (${this.completedTasks}/${this.totalTasks})`;
            if (this.failedTasks > 0) {
                progressElement.textContent += ` 失败: ${this.failedTasks}`;
            }
        }
    }
}

// 下载所有页面的PDF
async function downloadAllPdfs() {
    const downloadQueue = new DownloadQueue(3);
    const articleLinks = document.querySelectorAll('#gridTable > div > div > div > table > tbody > tr > td.name > a.fz14, #gridTable > div > div > div > table > tbody > tr > td.name > div > a.fz14');

    // 创建进度显示元素
    const progressElement = document.createElement('div');
    progressElement.className = 'download-progress';
    progressElement.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 4px; z-index: 9999;';
    document.body.appendChild(progressElement);

    // 添加下载任务到队列
    for (const link of articleLinks) {
        await downloadQueue.add({
            retries: 0,
            execute: async () => {
                const pdfUrl = await fetchPdfUrl(link.href);
                if (pdfUrl) {
                    // 检查是否包含验证码页面特征
                    if (pdfUrl.toLowerCase().includes('checkcode')) {
                        throw new Error('检测到验证码，请手动处理');
                    }
                    window.open(pdfUrl, '_blank');
                } else {
                    throw new Error('无法获取PDF链接');
                }
            }
        });
    }
}
