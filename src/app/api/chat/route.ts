import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    // APIキーの確認
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API Key not found');
      return NextResponse.json({ 
        success: false, 
        error: 'OpenAI APIキーが設定されていません。' 
      }, { status: 500 });
    }

    // OpenAIクライアントを動的に初期化
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

          const { messages, availableVariables, sampleData, totalRecipients } = await request.json() as {
            messages: Array<{role: 'user' | 'assistant' | 'system'; content: string}>;
            availableVariables: string[];
            sampleData: Array<Record<string, unknown>>;
            totalRecipients: number;
          };

    // 入力データの検証
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ 
        success: false, 
        error: 'メッセージが正しく送信されませんでした。' 
      }, { status: 400 });
    }

    // 実際のデータサンプルを使用した変数説明を作成
    const createVariableExplanations = () => {
            if (sampleData && sampleData.length > 0) {
              return availableVariables.map((v: string) => {
                const examples = sampleData.map((data: Record<string, unknown>) => data[v]).filter(val => val).slice(0, 3);
          switch(v) {
            case 'name': return `- {name}: 宛先の氏名（実際の例：${examples.join('、') || '田中太郎'}）`;
            case 'email': return `- {email}: 宛先のメールアドレス（実際の例：${examples.join('、') || 'tanaka@company.com'}）`;
            case 'company': return `- {company}: 宛先の会社名（実際の例：${examples.join('、') || '株式会社サンプル'}）`;
            case 'department': return `- {department}: 宛先の部署名（実際の例：${examples.join('、') || '営業部'}）`;
            case 'position': return `- {position}: 宛先の役職名（実際の例：${examples.join('、') || '営業マネージャー'}）`;
            default: return `- {${v}}: ${v}（実際の例：${examples.join('、') || '（データなし）'}）`;
          }
        }).join('\n');
      } else {
        return availableVariables.map((v: string) => {
          switch(v) {
            case 'name': return '- {name}: 宛先の氏名（例：田中太郎）';
            case 'email': return '- {email}: 宛先のメールアドレス（例：tanaka@company.com）';
            case 'company': return '- {company}: 宛先の会社名（例：株式会社サンプル）';
            case 'department': return '- {department}: 宛先の部署名（例：営業部）';
            case 'position': return '- {position}: 宛先の役職名（例：営業マネージャー）';
            default: return `- {${v}}: ${v}`;
          }
        }).join('\n');
      }
    };

    // システムプロンプトを作成
    const systemPrompt = `あなたは日本のビジネスメール作成の専門家です。以下の条件に従ってメールの件名と本文を作成してください：

【配信対象情報】
- 総配信件数: ${totalRecipients || 0}件
- 利用可能なデータ: ${availableVariables.join('、')}

【利用可能な変数と実際のデータ例】
${createVariableExplanations()}

【変数の使用方法と重要なポイント】
1. 変数は必ず半角の波括弧で囲む：{name}、{company}など
2. 変数を効果的に組み合わせる例：
   - 「{company}の{department}でご活躍の{name}様」
   - 「{position}として{company}にお勤めの{name}様」
   - 「{department}{position}の{name}様」
3. 個別化を最大化するため、可能な限り多くの変数を使用する
4. 変数が空の場合でも自然な文章になるよう配慮する

【メール作成の重要な指示】
1. 日本のビジネスマナーに適した丁寧な敬語を使用
2. 変数を効果的に活用して高度に個別化された内容にする
3. 署名部分は含めない（システムで自動追加）
4. 件名と本文を明確に分けて提示
5. 簡潔で分かりやすく、かつ具体的な内容
6. 受信者の属性（部署・役職）に応じた適切な内容

【出力形式】
件名: [ここに件名]

本文:
[ここに本文]

【出力例】
件名: 【{company}】{department}の{position}様へ重要なお知らせ

本文:
{name}様（{position}）

いつもお世話になっております。

{company}の{department}でご活躍の{name}様に、
重要なお知らせをお送りいたします。

（以下、具体的な内容）

ユーザーとの会話を通じて、目的や内容を確認しながら最適なメールを作成してください。実際のデータに基づいて、より具体的で個別化されたメールを心がけてください。`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // gpt-5-nanoが利用できない場合の代替
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'エラーが発生しました。';

    return NextResponse.json({ 
      success: true, 
      response: response 
    });

  } catch (error: unknown) {
    console.error('ChatGPT API Error:', error);
    
    // より詳細なエラーメッセージ
    let errorMessage = 'メール作成中にエラーが発生しました。';
    
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = error.error as {type?: string; code?: string};
      if (apiError.type === 'invalid_api_key') {
        errorMessage = 'OpenAI APIキーが無効です。';
      } else if (apiError.code === 'rate_limit_exceeded') {
        errorMessage = 'API利用制限に達しました。しばらく待ってから再試行してください。';
      } else if (apiError.code === 'insufficient_quota') {
        errorMessage = 'OpenAI APIの利用枠を超過しています。';
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      details: (error && typeof error === 'object' && 'message' in error) ? String(error.message) : '不明なエラー'
    }, { status: 500 });
  }
}
