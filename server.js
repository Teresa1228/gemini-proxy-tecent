/**
 * server.js
 * 增加了简单的签名验证和统一的响应格式
 */
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto'; // 引入加密模块

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// 0. 配置与密钥管理
// ==========================================

// API Key 列表
const rawKeys = process.env.GEMINI_API_KEYS || "";
const API_KEYS = rawKeys.split(',').map(k => k.trim()).filter(k => k);
let currentKeyIndex = 0;

// 🔐 签名验证的密钥 (建议放入 .env 文件: AUTH_SECRET=my_super_secret_pwd)
const AUTH_SECRET = process.env.AUTH_SECRET || "ilovegemini123"; 

if (API_KEYS.length === 0) {
    console.error("❌ 未找到 API Key，请检查配置");
} else {
    console.log(`✅ 已加载 ${API_KEYS.length} 个 Key。当前默认使用第 1 个。`);
    console.log(`🔐 鉴权密钥已设置: ${AUTH_SECRET}`);
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// ==========================================
// 🛠 工具函数：统一返回格式 (复刻你的PHP逻辑)
// ==========================================
const sendResult = (res, code, msg = "success", data = "") => {
    // 默认错误码处理
    const finalCode = code ? code : 10010;
    const finalMsg = msg ? msg : "error";
    const finalData = data ? data : "";

    res.json({
        code: finalCode,
        message: finalMsg,
        data: finalData
    });
};

const success = (res, data = "success", msg = "success") => {
    return sendResult(res, 10000, msg, data);
};

const error = (res, msg = "error", code = 10010) => {
    return sendResult(res, code, msg, "");
};

// ==========================================
// 🛡 中间件：签名验证算法
// ==========================================
// server.js 中的 authMiddleware 部分

const authMiddleware = (req, res, next) => {
    // 1. 获取 Header 参数
    const sign = req.headers['x-sign'];
    const timestamp = req.headers['x-time'];
    const nonce = req.headers['x-nonce']; // 🆕 新增获取 nonce

    // 2. 基础非空校验
    if (!sign || !timestamp || !nonce) {
        return error(res, "缺少鉴权参数 (x-sign, x-time, x-nonce)");
    }

    // 3. 时间戳校验 (防止超时的重放)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) { 
        return error(res, "请求已过期，请校准时间");
    }

    // =============================================
    // 🆕 核心算法更新：加入了 nonce
    // 拼接顺序务必和 PHP 端保持一致： 密钥 + 时间戳 + 随机数
    // =============================================
    const rawString = AUTH_SECRET + timestamp + nonce;

    // 4. 计算服务端签名
    const serverSign = crypto.createHash('md5').update(rawString).digest('hex');

    // 5. 比对签名
    if (sign !== serverSign) {
        console.log(`[Auth Fail] Client: ${sign} | Server: ${serverSign}`);
        return error(res, "签名验证失败 (Invalid Signature)");
    }

    /* 高级拓展 (可选): 
       如果需要极其严格的防重放，可以将 nonce 存入 Redis，有效期 5 分钟。
       如果发现同一个 nonce 在 5 分钟内再次出现，直接拒绝。
       目前上面的逻辑已经足够防御大部分攻击。
    */

    next();
};

// ==========================================
// 🎮 接口定义
// ==========================================

// 管理员切换 Key (增加 authMiddleware 保护)
app.post('/api/admin/switch', authMiddleware, (req, res) => {
    const { index } = req.body;

    if (typeof index !== 'number') {
        return error(res, "参数 index 必须是数字");
    }
    
    if (index < 0 || index >= API_KEYS.length) {
        return error(res, `索引无效，范围 0 - ${API_KEYS.length - 1}`);
    }

    currentKeyIndex = index;
    const keySuffix = API_KEYS[currentKeyIndex].slice(-4);
    
    console.log(`[Admin] 切换至 Key #${currentKeyIndex + 1}`);

    // 使用封装的 success 返回
    return success(res, {
        currentIndex: currentKeyIndex,
        totalKeys: API_KEYS.length,
        currentKeySuffix: keySuffix
    }, "切换成功");
});

// 生成接口 (增加 authMiddleware 保护)
app.post('/api/generate', authMiddleware, async (req, res) => {
    try {
        const { model, contents, config } = req.body;
        const activeKey = API_KEYS[currentKeyIndex];
        
        console.log(`[Request] Model: ${model} | Key Index: ${currentKeyIndex}`);

        const ai = new GoogleGenAI({ apiKey: activeKey });
        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: config
        });

        // 注意：这里返回的是 Gemini 的原始数据结构作为 'data'
        // 如果你想完全符合 code/message 结构，就这样包一层：
        return success(res, response, "生成成功");

    } catch (err) {
        console.error("API Error:", err.message);
        return error(res, err.message || "Gemini API 调用失败");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});