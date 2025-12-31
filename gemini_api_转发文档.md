# Gemini API Proxy Server 接口文档

这是一个基于 Node.js 的 Gemini API 中转服务。它封装了 Google GenAI SDK，提供了统一的调用接口，并集成了 **签名验证**、**开发者模式** 和 **远程管理** 机制。

**主要特性：**

* 🛡️ **高安全性**：采用 `MD5(密钥 + 时间戳 + 随机数)` 签名，防篡改、防重放。
* ⚡ **开发友好**：支持 **Developer Token** 免签名调用，方便调试。
* 🔧 **远程管理**：支持远程开启/关闭“开发者模式”及切换 API Key。
* 📦 **统一响应**：遵循标准 JSON 结构 (`code`, `message`, `data`)。
* 🚀 **全能支持**：支持 Gemini 1.5/2.5/3.0 系列模型的文本、识图、画图及联网搜索。

---

## 1. 基础信息

* **服务地址**: `https://你的域名/api/generate` 
* **请求方法**: `POST`
* **Content-Type**: `application/json`

---

## 2. 🔐 鉴权机制 (多种模式)

本服务支持两种鉴权模式：**标准签名模式**（生产环境推荐）和 **开发者 VIP 模式**（调试推荐）。

### 2.1 模式 A: 标准签名验证 (生产环境)

默认情况下，所有请求必须在 **Header** 中携带以下三个参数：

| Header 字段 | 说明 | 示例 |
| --- | --- | --- |
| `x-time` | 当前 Unix 时间戳 (秒)，有效期为 5 分钟 (±300s) | `1735460000` |
| `x-nonce` | 随机字符串 (推荐 16位以上)，用于防止重放攻击 | `a1b2c3d4e5...` |
| `x-sign` | 签名字符串 (MD5加密结果) | `8d969eef6...` |

#### 签名生成算法

1. **准备密钥 (Secret)**: 服务端配置的 `AUTH_SECRET`。
2. **获取时间戳**: 当前秒级时间戳 (String).
3. **生成随机数**: 生成唯一的 `nonce` (String).
4. **拼接字符串**: `原始字符串 = 密钥 + 时间戳 + 随机数`
5. **计算哈希**: 对原始字符串进行 **MD5** 加密 (32位小写)。

---

### 2.2 模式 B: ⚡ 开发者 VIP 通道 (免签名)

为了方便前端调试或本地开发，无需计算复杂的 MD5 签名，直接使用预设的 **超级密码 (Token)** 即可调用。

* **适用场景**: Postman 调试、本地开发、内网测试。
* **使用方法**: 在 Header 中添加 `x-dev-token`。

| Header 字段 | 说明 | 示例 |
| --- | --- | --- |
| `x-dev-token` | 对应服务端 `.env` 中的 `DEV_TOKEN` | `admin666` |

> **注意**: 只要 Header 中包含正确的 `x-dev-token`，服务端将自动忽略 `x-sign` 验证。请勿在生产环境的前端代码中暴露此 Token。

---

## 3. 请求参数 (Body)

Body 数据包包含具体的生成指令。

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | String | 是 | 模型名称。如 `gemini-2.5-flash`, `gemini-2.5-flash-image` |
| `contents` | Array | 是 | 对话历史或提示词。包含 `role` 和 `parts`。 |
| `config` | Object | 否 | 用于控制图片比例、输出类型(文本/图片)、联网搜索等。 |

### `contents` 结构示例

```json
[
  {
    "role": "user",
    "parts": [
      { "text": "生成一张赛博朋克风格的猫的图片" }
    ]
  }
]

```

---

## 4. 📦 响应结构

接口无论成功或失败，HTTP 状态码通常为 200，需通过业务状态码 `code` 判断。

### ✅ 成功响应 (Code: 10000)

```json
{
  "code": 10000,
  "message": "success",
  "data": {
    "candidates": [
      {
        "content": {
          "parts": [
             { "text": "..." }, // 文本结果
             { "inlineData": { "mimeType": "...", "data": "..." } } // 图片Base64结果
          ]
        },
        "finishReason": "STOP"
      }
    ]
  }
}

```

### ❌ 失败响应 (Code: 10010)

```json
{
  "code": 10010,
  "message": "签名验证失败 (Invalid Signature)",
  "data": ""
}

```

---

## 5. 调用代码示例

### 🟢 PHP 后端接入 (推荐 - 标准签名)

```php
<?php
// 配置
$secret = "ilovegemini123";  
$apiUrl = "http://127.0.0.1:8080/api/generate";

// 1. 准备鉴权数据
$timestamp = time();
$nonce = md5(uniqid(mt_rand(), true)); 
$sign = md5($secret . $timestamp . $nonce); 

// 2. 准备请求体
$data = [
    "model" => "gemini-1.5-flash",
    "contents" => [ [ "parts" => [ ["text" => "你好"] ] ] ]
];

// 3. 发送 cURL 请求
$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-time: ' . $timestamp,
    'x-nonce: ' . $nonce,
    'x-sign: ' . $sign
]);

$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>

```

### 🟡 JavaScript 前端调用 (开发者模式)

```javascript
// 适用于调试，直接使用 x-dev-token 跳过签名
fetch('http://localhost:8080/api/generate', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-dev-token': 'admin666' // 🔥 你的 DEV_TOKEN
    },
    body: JSON.stringify({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "你好" }] }]
    })
})
.then(res => res.json())
.then(data => console.log(data));

```

---

## 6. 错误代码排查

| 状态码 (`code`) | 错误信息 (`message`) | 原因排查 |
| --- | --- | --- |
| **10010** | `签名验证失败` | 1. 密钥 `AUTH_SECRET` 不一致。<br>

<br>2. 拼接顺序错误。<br>

<br>3. 前后端 MD5 算法差异。 |
| **10010** | `请求已过期` | 服务器时间与客户端时间相差超过 300秒。 |
| **10010** | `缺少鉴权参数` | Header 中缺少必要参数，且未提供正确的 `x-dev-token`。 |
| **403** | `管理员密码错误` | 调用管理接口时 `password` 错误。 |

---

## 7. 更多业务场景示例 (Payload)

以下是针对不同业务场景的 Request Body JSON 示例。请将这些 JSON 对象作为请求体发送，并确保 Header 中包含正确的鉴权签名。

### 场景 A: 文生图 (Text to Image)

*   **模型**: `gemini-2.5-flash-image`
*   **注意**: 必须配置 `responseModalities` 为 `["IMAGE"]`

```json
{
  "model": "gemini-2.5-flash-image",
  "contents": [{
    "parts": [{ "text": "A futuristic city with neon lights, cyberpunk style" }]
  }],
  "config": {
    "responseModalities": ["IMAGE"],
    "imageConfig": { "aspectRatio": "16:9" }
  }
}
```

### 场景 B: 搜索落地 (Grounding with Search)

*   **模型**: `gemini-3-pro-image-preview`
*   **注意**: Gemini 3 Pro 支持联网搜索工具

```json
{
  "model": "gemini-3-pro-image-preview",
  "contents": [{
    "parts": [{ "text": "Generate a chart image showing the weather in New York for the next 3 days." }]
  }],
  "config": {
    "responseModalities": ["TEXT", "IMAGE"],
    "tools": [{ "googleSearch": {} }]
  }
}
```

### 场景 C: 图片编辑/图生图 (Image Editing)

*   **模型**: `gemini-2.5-flash-image`
*   **注意**: 需要将图片转为 Base64 字符串 (不带 data 前缀)。

```json
{
  "model": "gemini-2.5-flash-image",
  "contents": [{
    "parts": [
      { "text": "Put a pair of sunglasses on the cat" },
      { 
        "inlineData": { 
          "mimeType": "image/jpeg", 
          "data": "BASE64_STRING_HERE" 
        } 
      }
    ]
  }],
  "config": {
    "responseModalities": ["IMAGE"]
  }
}
```

---

## 8. 💡 实用技巧

### 如何在本地快速测试 Base64 图片上传？

由于 `curl` 很难直接发送巨大的 Base64 字符串，建议使用以下方式测试带图片的请求：

1.  **使用 Postman / Apifox**：
    * 新建 POST 请求。
    * Body 选择 `raw` -> `JSON`。
    * 粘贴上述 JSON，利用在线工具将图片转为 Base64 粘贴到 `data` 字段中。
    * **重要**: 别忘了在 Header 中添加 `x-time`, `x-nonce`, `x-sign` (可以使用脚本自动生成或手动计算)。

---

## 9. 🔧 管理员接口 (Admin API)

本服务提供了一组管理接口，用于动态控制服务器状态。调用这些接口不需要签名，但必须在 Body 中携带 **管理员密码** (`ADMIN_PASSWORD`)。

### 9.1 🎚️ 远程开关：开发者模式 (Toggle Dev Mode)

开启后，服务器进入**“裸奔模式”**，所有 `/api/generate` 请求均 **不需要** 任何签名或 Token 即可调用。

* **URL**: `/api/admin/toggle-dev`
* **Method**: `POST`

**Request Body:**

```json
{
  "password": "admin666",  // 必填，对应 .env 中的 ADMIN_PASSWORD
  "enable": true           // true=开启免鉴权模式; false=恢复安全鉴权
}

```

**Response:**

```json
{
  "code": 10000,
  "message": "⚠️ 已开启开发者模式 (无需鉴权)",
  "data": { "isDevMode": true }
}

```

### 9.2 🔑 切换 API Key (Switch Key)

当某个 Key 耗尽或报错时，可强制切换到下一个 Key。

* **URL**: `/api/admin/switch`
* **Method**: `POST`

**Request Body:**

```json
{
  "password": "admin666",
  "index": 1  // 切换到第 2 个 Key (索引从 0 开始)
}

```

---

## 10. ⚙️ 服务端环境配置 (.env)

为了支持上述新功能，请确保服务端的 `.env` 文件包含以下配置：

```env
# 端口
PORT=8080


# 🔐 签名验证密钥 (用于 MD5 签名)
AUTH_SECRET=ilovegemini123

# 🔑 管理员密码 (用于 /api/admin/* 接口)
ADMIN_PASSWORD=admin666

# ⚡ 开发者 Token (用于 x-dev-token Header 免签名)
DEV_TOKEN=dev_token_secret

```