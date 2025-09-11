'use client';

import { useState, useEffect } from 'react';
import { Upload, Mail, FileText, Send, CheckCircle, AlertCircle, Edit3, Eye, Shield, User, Users, Clock, LogOut, Zap, ArrowLeft, MessageSquare, Copy } from 'lucide-react';
import { replaceTemplateVariables, createTemplateVariables, previewTemplate } from '@/lib/templateEngine';
import { PublicClientApplication, AccountInfo } from '@azure/msal-browser';

// Phase 2: 宛先リストとテンプレートを分離
interface ContactData {
  email: string;
  name: string;
  company?: string;
  department?: string;
  position?: string;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

// Phase 1との互換性のため残す
interface EmailData {
  email: string;
  subject: string;
  body: string;
}

interface SendResult {
  index: number;
  email: string;
  success: boolean;
  message: string;
}

export default function Home() {
  const [senderEmail, setSenderEmail] = useState('');
  const [delay, setDelay] = useState(5);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [emailData, setEmailData] = useState<EmailData[]>([]);
  const [preview, setPreview] = useState<EmailData[]>([]);
  const [results, setResults] = useState<SendResult[]>([]);
  const [currentStep, setCurrentStep] = useState<'auth' | 'upload' | 'template' | 'preview' | 'sending' | 'results'>('auth');
  const [authenticatedUser, setAuthenticatedUser] = useState<AccountInfo | null>(null);
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [error, setError] = useState('');
  
  // AI Chat 関連の状態
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  // Phase 2: 新しいステート
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({
    subject: '',
    body: ''
  });

  // MSAL初期化（クライアントサイドのみ）
  useEffect(() => {
    // SSR環境ではcryptoオブジェクトが利用できないため、クライアントサイドでのみ実行
    if (typeof window !== 'undefined') {
      const initializeMsal = async () => {
        try {
          // 動的インポートでMSAL設定を読み込み
          const { msalConfig } = await import('@/lib/msalConfig');
          const instance = new PublicClientApplication(msalConfig);
          await instance.initialize();
          setMsalInstance(instance);
          
          // リダイレクト後の処理
          try {
            const response = await instance.handleRedirectPromise();
            if (response && response.account) {
              const account = response.account;
              if (account.username.includes('@festal-inc.com')) {
                setAuthenticatedUser(account);
                setSenderEmail(account.username);
                setCurrentStep('upload');
              } else {
                setError('Festalのメールアドレスでログインしてください');
                await instance.logoutRedirect();
              }
            }
          } catch (error) {
            console.error('Redirect handling failed:', error);
          }
          
          // 既存のアカウントをチェック
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            const account = accounts[0];
            if (account.username.includes('@festal-inc.com')) {
              setAuthenticatedUser(account);
              setSenderEmail(account.username);
              setCurrentStep('upload');
            }
          }
        } catch (error) {
          console.error('MSAL initialization failed:', error);
          setError('認証システムの初期化に失敗しました。ページを再読み込みしてください。');
        }
      };
      
      initializeMsal();
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
    }
  };

  const handleAuth = async () => {
    if (!msalInstance) {
      setError('認証システムの初期化中です。しばらくお待ちください。');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // 動的インポートでログイン設定を読み込み
      const { loginRequest } = await import('@/lib/msalConfig');
      // リダイレクト方式を使用
      await msalInstance.loginRedirect(loginRequest);
      
    } catch (error: unknown) {
      console.error('Login failed:', error);
      if (error && typeof error === 'object' && 'errorCode' in error && error.errorCode === 'user_cancelled') {
        setError('ログインがキャンセルされました');
      } else {
        setError('Microsoftログインに失敗しました');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    if (!msalInstance) return;
    
    try {
      await msalInstance.logoutPopup();
      setAuthenticatedUser(null);
      setSenderEmail('');
      setCurrentStep('auth');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    if (!senderEmail || !authenticatedUser) {
      setError('認証が必要です。再度ログインしてください。');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('senderEmail', senderEmail);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // 宛先リストをセットしてテンプレート作成画面へ
        setContacts(result.data);
        setCurrentStep('template');
      } else {
        setError(result.error);
      }
    } catch {
      setError('ファイルのアップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!emailData.length) return;

    setCurrentStep('sending');
    const sendResults: SendResult[] = [];

    try {
      for (let i = 0; i < emailData.length; i++) {
        const email = emailData[i];
        
        try {
          const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              senderEmail,
              recipientEmail: email.email,
              subject: email.subject,
              body: email.body,
              authenticatedUserEmail: authenticatedUser?.username || senderEmail,
            }),
          });

          const result = await response.json();
          
          sendResults.push({
            index: i + 1,
            email: email.email,
            success: result.success,
            message: result.message || (result.success ? '送信成功' : '送信失敗'),
          });

          setResults([...sendResults]);

          // 遅延
          if (i < emailData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
          }
        } catch {
          sendResults.push({
            index: i + 1,
            email: email.email,
            success: false,
            message: 'ネットワークエラー',
          });
          setResults([...sendResults]);
        }
      }

      setCurrentStep('results');
    } catch {
      setError('メール送信中にエラーが発生しました');
    }
  };

  const reset = () => {
    setFile(null);
    setEmailData([]);
    setPreview([]);
    setResults([]);
    setCurrentStep('upload');
    setError('');
    setSenderEmail('');
    setShowAIChat(false);
    setChatMessages([]);
    setCurrentMessage('');
    setIsAILoading(false);
  };

  // AI Chat 関数
  const sendChatMessage = async () => {
    if (!currentMessage.trim()) return;

    const newUserMessage = { role: 'user' as const, content: currentMessage };
    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);
    setCurrentMessage('');
    setIsAILoading(true);

    try {
      const availableVars = contacts.length > 0 
        ? Object.keys(contacts[0]).filter(key => key !== 'email' && key !== 'name')
        : ['name', 'email', 'company', 'department', 'position'];

      // 実際のデータサンプルを取得
      const sampleData = contacts.length > 0 ? contacts.slice(0, 3) : [];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          availableVariables: ['name', 'email', ...availableVars],
          sampleData: sampleData,
          totalRecipients: contacts.length
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const assistantMessage = { role: 'assistant' as const, content: data.response };
        setChatMessages([...updatedMessages, assistantMessage]);
        
        // メール形式を検出して自動入力
        const emailMatch = data.response.match(/件名:\s*(.+?)(?:\n|$)/);
        const bodyMatch = data.response.match(/本文:\s*([\s\S]*?)(?:\n\n|$)/);
        
        if (emailMatch && bodyMatch) {
          setEmailTemplate({
            subject: emailMatch[1].trim(),
            body: bodyMatch[1].trim()
          });
        }
      } else {
        const errorMessage = data.error || 'エラーが発生しました。もう一度お試しください。';
        setChatMessages([...updatedMessages, { 
          role: 'assistant', 
          content: `❌ ${errorMessage}${data.details ? `\n詳細: ${data.details}` : ''}` 
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages([...updatedMessages, { 
        role: 'assistant', 
        content: 'エラーが発生しました。もう一度お試しください。' 
      }]);
    }

    setIsAILoading(false);
  };

  const startAIChat = () => {
    setShowAIChat(true);
    if (chatMessages.length === 0) {
      setChatMessages([{
        role: 'assistant',
        content: 'こんにちは！メール作成をお手伝いします。\n\nどのような目的のメールを作成しますか？\n例：\n- セミナーの案内\n- 新商品の紹介\n- 会議の招待\n- お礼のメール\n\n目的を教えてください！'
      }]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white rounded-full shadow-lg">
                <Mail className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              株式会社Festal
            </h1>
            <p className="text-xl text-gray-600">メール配信システム</p>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {currentStep === 'auth' && (
              <div className="space-y-6">
                <div className="flex items-center mb-6">
                  <Shield className="h-7 w-7 text-blue-600 mr-3" />
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Microsoft認証
                  </h2>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-blue-600 mr-3">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-blue-800 font-medium">セキュリティ認証</p>
                      <p className="text-blue-700 text-sm">Microsoftアカウントで安全にログインします</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-yellow-600 mr-3">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-yellow-800 font-medium">重要</p>
                      <p className="text-yellow-700 text-sm">Festalのメールアドレス(@festal-inc.com)でのみログイン可能です</p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleAuth}
                  disabled={!msalInstance || isUploading}
                  className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Microsoftログイン中...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Microsoftでログイン
                    </div>
                  )}
                </button>
              </div>
            )}

            {currentStep === 'upload' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    ファイルアップロード
                  </h2>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-1" />
                      <strong>{authenticatedUser?.name}</strong> ({authenticatedUser?.username})
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center text-red-600 hover:text-red-800 text-sm"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      ログアウト
                    </button>
                  </div>
                </div>

                {/* 送信者情報（表示のみ） */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-green-600 mr-3">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-green-800 font-medium">送信者アカウント</p>
                      <p className="text-green-700 text-sm">
                        <strong>{authenticatedUser?.name}</strong> ({senderEmail})
                      </p>
                      <p className="text-green-600 text-xs mt-1">
                        認証済みアカウントから送信されます
                      </p>
                    </div>
                  </div>
                </div>

                {/* 送信間隔 */}
                <div>
                  <div className="flex items-center mb-2">
                    <Clock className="h-4 w-4 text-gray-600 mr-2" />
                    <label className="text-sm font-medium text-gray-700">
                      送信間隔
                    </label>
                  </div>
                  <select
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>1秒</option>
                    <option value={3}>3秒</option>
                    <option value={5}>5秒（推奨）</option>
                    <option value={10}>10秒</option>
                  </select>
                </div>

                {/* ファイルアップロード */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    メール配信リスト
                  </label>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
                  >
                    <Upload className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      ファイルをドラッグ&ドロップ
                    </p>
                    <p className="text-gray-500 mb-4">または</p>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      id="fileInput"
                    />
                    <label
                      htmlFor="fileInput"
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      ファイルを選択
                    </label>
                    <div className="text-sm text-gray-500 mt-6 text-left">
                      <div className="flex items-center justify-start mb-3">
                        <FileText className="h-4 w-4 mr-2" />
                        <strong>対応形式:</strong> Excel (.xlsx, .xls), CSV (.csv)
                      </div>
                      <div className="flex items-center justify-start mb-2">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        <strong>必須カラム:</strong>
                      </div>
                      <div className="ml-6 mb-3 text-gray-600">
                        • email, name
                      </div>
                      <div className="flex items-center justify-start mb-2">
                        <Users className="h-4 w-4 mr-2 text-blue-600" />
                        <strong>オプションカラム:</strong>
                      </div>
                      <div className="ml-6 mb-4 text-gray-600">
                        • company, department, position
                      </div>
                      <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded-md">
                        <div className="mb-1">※ Excel: 「宛先リスト」シートを優先読込</div>
                        <div className="mb-1">※ CSV: 任意のファイル名でアップロード可能</div>
                        <div>※ テンプレート作成画面で件名・本文を作成</div>
                      </div>
                    </div>
                  </div>
                  
                  {file && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-blue-800">
                        <FileText className="inline h-5 w-5 mr-2" />
                        {file.name}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!file || !authenticatedUser || isUploading}
                  className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      処理中...
                    </div>
                  ) : (
                    <>
                      <Upload className="inline h-5 w-5 mr-2" />
                      ファイルをアップロード
                    </>
                  )}
                </button>
              </div>
            )}

            {currentStep === 'template' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Edit3 className="h-7 w-7 text-blue-600 mr-3" />
                    <h2 className="text-2xl font-semibold text-gray-800">
                      メールテンプレート作成
                    </h2>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-1" />
                    宛先: <strong>{contacts.length}件</strong>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-blue-600 mr-3">
                      <Edit3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-blue-800 font-medium">テンプレート機能</p>
                      <p className="text-blue-700 text-sm">
                        変数を使って個別化されたメールを作成できます: {'{name}'}, {'{company}'}, {'{department}'} など
                      </p>
                    </div>
                  </div>
                </div>

                {/* メール作成方法の選択 - 中央配置 */}
                <div className="flex justify-center">
                  <div className="space-y-6 max-w-4xl w-full">
                    {/* 見出し */}
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">メール作成方法を選択</h3>
                      <p className="text-gray-600">お好みの方法でメールテンプレートを作成できます</p>
                    </div>

                    {/* 2つの選択肢 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* AI会話型 - 簡単作成 */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                        <div className="text-center space-y-4">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                            <MessageSquare className="h-8 w-8 text-green-600" />
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-green-800">AI会話で簡単作成</h4>
                            <p className="text-green-700 text-sm mt-2">
                              初心者向け・手軽にメールを作りたい方におすすめ
                            </p>
                          </div>
                          <ul className="text-sm text-green-700 space-y-1 text-left">
                            <li>• AIとチャットで対話しながら作成</li>
                            <li>• 目的を伝えるだけで自動生成</li>
                            <li>• 変数の使い方もAIがサポート</li>
                            <li>• 生成された文章は簡単コピー</li>
                          </ul>
                          <button
                            onClick={startAIChat}
                            className="w-full flex items-center justify-center px-6 py-3 text-lg bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg"
                          >
                            <MessageSquare className="h-5 w-5 mr-2" />
                            AIと会話でメール作成
                          </button>
                        </div>
                      </div>

                      {/* 手動テンプレート - 本格作成 */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                        <div className="text-center space-y-4">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
                            <Edit3 className="h-8 w-8 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-blue-800">手動で本格作成</h4>
                            <p className="text-blue-700 text-sm mt-2">
                              上級者向け・細かくカスタマイズしたい方におすすめ
                            </p>
                          </div>
                          <ul className="text-sm text-blue-700 space-y-1 text-left">
                            <li>• 件名・本文を直接入力して作成</li>
                            <li>• 変数を自由に組み合わせ可能</li>
                            <li>• リアルタイムプレビューで確認</li>
                            <li>• 細かな表現まで完全制御</li>
                            <li>• 外部ChatGPT/Claude用プロンプト生成</li>
                          </ul>
                          
                          {/* プロンプトコピーボタン */}
                          <div className="pt-2">
                            <button
                              onClick={() => {
                                
                                const aiPrompt = `以下の条件でビジネスメールの件名と本文を作成してください：

【メール作成依頼】
- 目的: [ここに目的を記載してください（例：セミナーの案内、新商品の紹介、定期連絡など）]
- 対象: ビジネス関係者

【利用可能な変数と説明】
- {name} → 宛先の氏名（例：田中太郎）
- {email} → 宛先のメールアドレス（例：tanaka@company.com）
- {company} → 宛先の会社名（例：株式会社サンプル）
- {department} → 宛先の部署名（例：営業部）
- {position} → 宛先の役職名（例：営業マネージャー）

【変数の使用方法】
- 文中で {変数名} の形で記載してください
- 使用例: 「{name}様」「{company}の{department}」「{position}としてご活躍の{name}様」
- 個人に合わせた内容にするため、可能な限り変数を活用してください

【出力形式】
件名: [ここに件名]

本文:
[ここに本文]

【追加要件】
- 丁寧で適切なビジネス文書として作成
- 変数を効果的に活用して個別化された内容にする
- 簡潔で分かりやすい内容
- 署名部分は含めない（システムで自動追加されます）
- 日本のビジネスマナーに適した敬語を使用`;

                                navigator.clipboard.writeText(aiPrompt).then(() => {
                                  alert('📋 外部AI用プロンプトをコピーしました！\nChatGPTやClaudeに貼り付けてメール文を作成し、結果を下のフォームに貼り付けてください。');
                                }).catch(() => {
                                  alert('❌ コピーに失敗しました。手動でコピーしてください。');
                                });
                              }}
                              className="flex items-center justify-center w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm text-sm"
                            >
                              <Zap className="h-4 w-4 mr-1" />
                              外部AI用プロンプトをコピー
                            </button>
                          </div>
                          
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* テンプレート作成・プレビュー - 下部左右分割 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                  {/* テンプレート作成 - 左側 */}
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <Edit3 className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-xl font-semibold text-gray-800">テンプレート作成</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          件名
                        </label>
                        <input
                          type="text"
                          value={emailTemplate.subject}
                          onChange={(e) => setEmailTemplate({...emailTemplate, subject: e.target.value})}
                          placeholder="例: 【{'{company}'}】セミナーのご案内"
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          本文
                        </label>
                        <textarea
                          value={emailTemplate.body}
                          onChange={(e) => setEmailTemplate({...emailTemplate, body: e.target.value})}
                          placeholder={`例:
{'{name}'}様

いつもお世話になっております。

来月のセミナーについてご案内いたします...`}
                          rows={16}
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base resize-none"
                        />
                      </div>
                    </div>

                    {/* 利用可能な変数 - 改善版 */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                      <h4 className="text-base font-semibold text-blue-800 mb-4 flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        利用可能な変数
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
                          <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono text-sm mr-3">{'{name}'}</code>
                          <span className="text-gray-700 text-sm">氏名</span>
                        </div>
                        <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
                          <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono text-sm mr-3">{'{email}'}</code>
                          <span className="text-gray-700 text-sm">メールアドレス</span>
                        </div>
                        <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
                          <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono text-sm mr-3">{'{company}'}</code>
                          <span className="text-gray-700 text-sm">会社名</span>
                        </div>
                        <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
                          <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono text-sm mr-3">{'{department}'}</code>
                          <span className="text-gray-700 text-sm">部署名</span>
                        </div>
                        <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
                          <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono text-sm mr-3">{'{position}'}</code>
                          <span className="text-gray-700 text-sm">役職名</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* プレビュー - 右側 */}
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <Eye className="h-5 w-5 text-green-600 mr-2" />
                      <h3 className="text-xl font-semibold text-gray-800">プレビュー</h3>
                    </div>
                    
                    <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200">
                        <div className="text-sm font-medium text-gray-600 mb-2">件名:</div>
                        <div className="font-semibold text-gray-800 text-base">
                          {emailTemplate.subject ? previewTemplate(emailTemplate.subject) : '件名を入力してください'}
                        </div>
                      </div>
                      <div className="p-5 bg-white min-h-[400px]">
                        <div className="text-sm font-medium text-gray-600 mb-3">本文:</div>
                        <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-700">
                          {emailTemplate.body ? previewTemplate(emailTemplate.body) : '本文を入力してください'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
                      <div className="flex items-start">
                        <div className="text-amber-600 mr-3 mt-1">
                          <Eye className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-amber-800 font-semibold mb-2">プレビュー説明</p>
                          <p className="text-amber-700 text-sm leading-relaxed">
                            実際の送信時は各宛先の情報で変数が置換されます。<br />
                            サンプルデータで表示されているため、実際の内容とは異なります。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                {/* ボタンエリア - 改善版 */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setCurrentStep('upload')}
                    className="flex items-center px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    戻る
                  </button>
                  <button
                    onClick={() => {
                      if (!emailTemplate.subject || !emailTemplate.body) {
                        setError('件名と本文を入力してください');
                        return;
                      }
                      
                      // テンプレートから実際のメールデータを生成
                      const generatedEmails = contacts.map(contact => {
                        const variables = createTemplateVariables(contact);
                        return {
                          email: contact.email,
                          subject: replaceTemplateVariables(emailTemplate.subject, variables),
                          body: replaceTemplateVariables(emailTemplate.body, variables)
                        };
                      });
                      
                      setEmailData(generatedEmails);
                      setPreview(generatedEmails.slice(0, 3));
                      setCurrentStep('preview');
                    }}
                    disabled={!emailTemplate.subject || !emailTemplate.body}
                    className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none"
                  >
                    プレビューを確認
                    <Eye className="h-4 w-4 ml-2" />
                  </button>
                </div>

                {/* AI Chat Modal */}
                {showAIChat && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col">
                      {/* Chat Header */}
                      <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <div className="flex items-center">
                          <MessageSquare className="h-6 w-6 text-green-600 mr-2" />
                          <h3 className="text-xl font-semibold text-gray-800">AIメール作成アシスタント</h3>
                        </div>
                        <button
                          onClick={() => setShowAIChat(false)}
                          className="text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {chatMessages.map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-3 relative group ${
                              message.role === 'user' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                {message.content}
                              </div>
                              {message.role === 'assistant' && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(message.content).then(() => {
                                      // 一時的な成功表示（簡易版）
                                      const button = document.activeElement as HTMLButtonElement;
                                      const originalText = button.title;
                                      button.title = 'コピーしました！';
                                      setTimeout(() => {
                                        button.title = originalText;
                                      }, 2000);
                                    }).catch(() => {
                                      alert('コピーに失敗しました');
                                    });
                                  }}
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white shadow-sm hover:bg-gray-50"
                                  title="メッセージをコピー"
                                >
                                  <Copy className="h-3 w-3 text-gray-600" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {isAILoading && (
                          <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg p-3">
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                <span className="text-sm text-gray-600">AIが考えています...</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chat Input */}
                      <div className="p-4 border-t border-gray-200">
                        <div className="space-y-2">
                          <div className="flex space-x-2">
                            <textarea
                              value={currentMessage}
                              onChange={(e) => setCurrentMessage(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isAILoading) {
                                  e.preventDefault();
                                  sendChatMessage();
                                }
                              }}
                              placeholder="メールの目的や内容について教えてください...&#10;（Ctrl + Enter または Cmd + Enter で送信）"
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                              disabled={isAILoading}
                              rows={3}
                            />
                            <button
                              onClick={sendChatMessage}
                              disabled={!currentMessage.trim() || isAILoading}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors self-end"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            Ctrl + Enter (Cmd + Enter): 送信 | Enter: 改行
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'preview' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    プレビュー
                  </h2>
                  <div className="text-lg font-medium text-blue-600">
                    総件数: {emailData.length}件
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <p className="text-green-800">ファイル読み込み完了</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-4">
                    プレビュー（最初の3件）
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">宛先</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">件名</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">本文</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((item, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 px-4 py-2">{item.email}</td>
                            <td className="border border-gray-300 px-4 py-2">{item.subject}</td>
                            <td className="border border-gray-300 px-4 py-2">
                              {item.body.length > 50 ? `${item.body.substring(0, 50)}...` : item.body}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
        </div>

                <div className="flex space-x-4">
                  <button
                    onClick={reset}
                    className="flex-1 py-3 px-6 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    戻る
                  </button>
                  <button
                    onClick={handleSend}
                    className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Send className="inline h-5 w-5 mr-2" />
                    メール送信開始
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'sending' && (
              <div className="text-center space-y-6">
                <h2 className="text-2xl font-semibold text-gray-800">
                  メール送信中
                </h2>
                
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                </div>
                
                <p className="text-gray-600">
                  進捗: {results.length} / {emailData.length} 件
                </p>

                {results.length > 0 && (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2">#</th>
                          <th className="border border-gray-300 px-4 py-2">宛先</th>
                          <th className="border border-gray-300 px-4 py-2">状態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((result) => (
                          <tr key={result.index}>
                            <td className="border border-gray-300 px-4 py-2">{result.index}</td>
                            <td className="border border-gray-300 px-4 py-2">{result.email}</td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className={`px-2 py-1 rounded-full text-sm ${
                                result.success 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {result.success ? '成功' : 'エラー'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'results' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-800">
                  送信結果
                </h2>

                <div className={`p-4 rounded-lg border ${
                  results.every(r => r.success) 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center mb-2">
                    {results.every(r => r.success) ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                    )}
                    <h3 className="font-medium">
                      {results.every(r => r.success) 
                        ? '全ての送信が完了しました！' 
                        : '送信が完了しました（一部エラーあり）'
                      }
                    </h3>
                  </div>
                  <p className="text-sm">
                    成功: {results.filter(r => r.success).length}件 / 
                    失敗: {results.filter(r => !r.success).length}件 / 
                    総計: {results.length}件
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full border-collapse border border-gray-300 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2">#</th>
                        <th className="border border-gray-300 px-4 py-2">宛先</th>
                        <th className="border border-gray-300 px-4 py-2">状態</th>
                        <th className="border border-gray-300 px-4 py-2">メッセージ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <tr key={result.index}>
                          <td className="border border-gray-300 px-4 py-2">{result.index}</td>
                          <td className="border border-gray-300 px-4 py-2">{result.email}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-sm ${
                              result.success 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {result.success ? '成功' : 'エラー'}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">
                            {result.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={reset}
                  className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  新しい配信を開始
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}