// 背景脚本，目前不需要功能，但Manifest v3要求必须有
chrome.runtime.onInstalled.addListener(() => {
  console.log('知网PDF下载助手已安装');
});