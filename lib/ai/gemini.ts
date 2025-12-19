/**
 * AI Work Tracker - OpenAI GPT Integration
 * 使用 OpenAI gpt-5-mini-2025-08-07 分析截图
 */

import { ScreenshotAnalysis, ActivityType, WorkReport, TimeBreakdown } from '@lib/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * 调用 OpenAI API
 */
async function callOpenAI(prompt: string, imageBase64?: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const messages: any[] = [];

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
            detail: 'high'
          }
        },
        { type: 'text', text: prompt }
      ]
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      messages,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data: OpenAIResponse = await response.json();
  return data.choices[0]?.message?.content || '{}';
}

/**
 * 分析单张截图
 */
export async function analyzeScreenshot(
  imageBase64: string
): Promise<Omit<ScreenshotAnalysis, 'id' | 'screenshot_id' | 'created_at'>> {
  const prompt = `分析这张屏幕截图，详细记录用户正在做什么。返回JSON：

{
  "app_name": "应用名称",
  "activity_type": "coding/browsing/documentation/communication/meeting/design/entertainment/other",
  "description": "一句话描述正在做什么",
  "detailed_content": "详细记录屏幕内容：正在编辑什么文件、写什么代码、看什么网页、和谁聊天聊什么、读什么文档等，200-400字，要具体"
}`;

  try {
    const response = await callOpenAI(prompt, imageBase64);
    const result = JSON.parse(response);

    return {
      app_name: result.app_name || 'Unknown',
      activity_type: validateActivityType(result.activity_type),
      description: result.description || '',
      detailed_content: result.detailed_content || '',
      tags: [],
      confidence: 0.8,
      raw_response: response
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Screenshot analysis failed:', errorMessage);

    return {
      app_name: 'Unknown',
      activity_type: 'other',
      description: '分析失败: ' + errorMessage.slice(0, 50),
      detailed_content: errorMessage,
      tags: [],
      confidence: 0,
      raw_response: errorMessage
    };
  }
}

/**
 * 生成工作报告
 */
export async function generateReport(
  analyses: ScreenshotAnalysis[],
  sessionDurationMinutes: number
): Promise<Omit<WorkReport, 'id' | 'session_id' | 'created_at'>> {
  const activityStats = new Map<ActivityType, number>();
  const appStats = new Map<string, number>();

  for (const analysis of analyses) {
    const activity = analysis.activity_type as ActivityType;
    activityStats.set(activity, (activityStats.get(activity) || 0) + 1);
    appStats.set(analysis.app_name, (appStats.get(analysis.app_name) || 0) + 1);
  }

  const totalCount = analyses.length || 1;
  const timeBreakdown: TimeBreakdown = {};

  activityStats.forEach((count, activity) => {
    const percentage = (count / totalCount) * 100;
    (timeBreakdown as Record<ActivityType, { duration_minutes: number; percentage: number }>)[activity] = {
      duration_minutes: Math.round((sessionDurationMinutes * count) / totalCount),
      percentage: Math.round(percentage)
    };
  });

  // 汇总活动内容
  const contents = analyses.slice(0, 30).map(a =>
    `[${a.app_name}] ${a.description}: ${a.detailed_content?.slice(0, 200) || ''}`
  ).join('\n');

  const prompt = `根据以下工作记录生成汇总，返回JSON：

工作时长：${sessionDurationMinutes}分钟
记录数：${analyses.length}

活动详情：
${contents}

{
  "summary": "今天的工作汇总，5-8句话，具体描述做了什么",
  "activity_log": ["主要活动1", "主要活动2", "...5-10项"]
}`;

  try {
    const response = await callOpenAI(prompt);
    const result = JSON.parse(response);

    return {
      summary: result.summary || '今日工作完成',
      highlights: Array.isArray(result.activity_log) ? result.activity_log : [],
      time_breakdown: timeBreakdown,
      productivity_score: 0,
      suggestions: [],
      generated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Report generation failed:', error);

    const topApps: string[] = [];
    appStats.forEach((_, app) => topApps.push(app));

    return {
      summary: `今日工作 ${sessionDurationMinutes} 分钟，共 ${analyses.length} 条记录。使用了 ${topApps.slice(0, 3).join('、') || '多个应用'}。`,
      highlights: topApps.slice(0, 5).map(app => `使用 ${app}`),
      time_breakdown: timeBreakdown,
      productivity_score: 0,
      suggestions: [],
      generated_at: new Date().toISOString()
    };
  }
}

function validateActivityType(type: string): ActivityType {
  const validTypes: ActivityType[] = [
    'coding', 'browsing', 'documentation', 'communication',
    'meeting', 'design', 'entertainment', 'other'
  ];
  return validTypes.includes(type as ActivityType) ? type as ActivityType : 'other';
}
