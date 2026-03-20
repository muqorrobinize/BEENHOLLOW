import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Download, Users, FileText, Loader2, Info } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [peerCount, setPeerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [sendMsgAction, setSendMsgAction] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Inisialisasi P2P WebRTC (Serverless) menggunakan Trystero
  useEffect(() => {
    let activeRoom;

    const initP2P = async () => {
      try {
        // Import Trystero secara dinamis (menggunakan public torrent trackers untuk signaling WebRTC)
        const trystero = await import('https://esm.sh/trystero/torrent');
        
        // Bergabung ke 1 domain global (semua device yang buka masuk ke sini)
        activeRoom = trystero.joinRoom({ appId: 'beenhollow-void-v2' }, 'global-muryokusho');
        
        // Buat aksi untuk mengirim dan menerima data (teks & blob)
        const [sendData, receiveData] = activeRoom.makeAction('transfer');
        setSendMsgAction(() => sendData);

        // Pantau jumlah device yang terhubung
        activeRoom.onPeerJoin((peerId) => {
          setPeerCount(Object.keys(activeRoom.getPeers()).length);
          setIsConnected(true);
        });

        activeRoom.onPeerLeave((peerId) => {
          const peersLeft = Object.keys(activeRoom.getPeers()).length;
          setPeerCount(peersLeft);
          if (peersLeft === 0) setIsConnected(false);
        });

        // Handler saat menerima data dari device lain
        receiveData((payload, peerId) => {
          if (payload.type === 'file') {
            // Ubah ArrayBuffer kembali menjadi Blob agar bisa didownload
            const blob = new Blob([payload.fileData], { type: payload.fileMime });
            const objectUrl = URL.createObjectURL(blob);
            
            setMessages(prev => [...prev, {
              id: Date.now().toString() + Math.random(),
              type: 'file',
              fileName: payload.fileName,
              fileSize: payload.fileSize,
              url: objectUrl,
              isMe: false,
              time: new Date()
            }]);
          } else if (payload.type === 'text') {
            setMessages(prev => [...prev, {
              id: Date.now().toString() + Math.random(),
              type: 'text',
              text: payload.text,
              isMe: false,
              time: new Date()
            }]);
          }
        });

      } catch (error) {
        console.error("Gagal menginisialisasi WebRTC:", error);
      }
    };

    initP2P();

    return () => {
      if (activeRoom) activeRoom.leave();
    };
  }, []);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendText = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !sendMsgAction) return;

    const payload = { type: 'text', text: inputText.trim() };
    
    // Tampilkan di layar sendiri
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'text',
      text: payload.text,
      isMe: true,
      time: new Date()
    }]);

    // Broadcast ke semua device lain
    sendMsgAction(payload);
    setInputText('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !sendMsgAction) return;

    setIsSending(true);

    try {
      // Ubah file menjadi ArrayBuffer untuk dikirim via WebRTC DataChannel
      const arrayBuffer = await file.arrayBuffer();
      
      const payload = {
        type: 'file',
        fileName: file.name,
        fileMime: file.type,
        fileSize: file.size,
        fileData: arrayBuffer
      };

      // Buat Blob URL untuk ditampilkan di layar pengirim
      const blob = new Blob([arrayBuffer], { type: file.type });
      const objectUrl = URL.createObjectURL(blob);

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'file',
        fileName: file.name,
        fileSize: file.size,
        url: objectUrl,
        isMe: true,
        time: new Date()
      }]);

      // Broadcast file buffer ke semua device
      sendMsgAction(payload);
    } catch (error) {
      console.error("Gagal mengirim file:", error);
      alert("Terjadi kesalahan saat memproses file.");
    } finally {
      setIsSending(false);
      // Reset input file
      e.target.value = null; 
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 font-sans selection:bg-purple-200">
      
      {/* HEADER: Clean Void */}
      <header className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10 sticky top-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            BEENHOLLOW
          </h1>
          <p className="text-xs text-slate-500 tracking-wide uppercase mt-1 flex items-center gap-1">
            Global P2P Transfer • No DB
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-purple-500' : 'bg-slate-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-purple-600' : 'bg-slate-500'}`}></span>
            </span>
            <span className="text-sm font-medium text-slate-600">
              {peerCount} Device
            </span>
            <Users size={14} className="text-slate-400 ml-1" />
          </div>
        </div>
      </header>

      {/* MESSAGE AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 max-w-sm mx-auto text-center">
            <div className="w-16 h-16 border border-slate-200 rounded-2xl flex items-center justify-center bg-white shadow-sm">
              <Info size={24} className="text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Ruang Kosong</p>
              <p className="text-xs text-slate-400 mt-1">
                Buka link ini di device lain. File atau teks yang dikirim akan langsung tersalurkan secara Peer-to-Peer. Data tidak disimpan di server manapun.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[60%] flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                  
                  <div className={`p-4 shadow-sm ${
                    msg.isMe 
                      ? 'bg-purple-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                  }`}>
                    
                    {/* Render Text */}
                    {msg.type === 'text' && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                    )}

                    {/* Render File */}
                    {msg.type === 'file' && (
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${msg.isMe ? 'bg-white/10' : 'bg-slate-50'}`}>
                          <FileText size={24} className={msg.isMe ? 'text-purple-100' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1 overflow-hidden min-w-[120px]">
                          <p className="text-sm font-medium truncate mb-1" title={msg.fileName}>
                            {msg.fileName}
                          </p>
                          <p className={`text-xs ${msg.isMe ? 'text-purple-200' : 'text-slate-500'}`}>
                            {formatSize(msg.fileSize)} • Blob
                          </p>
                        </div>
                        <a 
                          href={msg.url} 
                          download={msg.fileName}
                          className={`p-2 rounded-full transition-colors self-center ${
                            msg.isMe 
                              ? 'hover:bg-white/20 text-white' 
                              : 'hover:bg-purple-50 text-purple-600'
                          }`}
                          title="Download File"
                        >
                          <Download size={20} />
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <span className="text-[10px] text-slate-400 mt-1.5 px-1 font-medium">
                    {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* INPUT AREA: Minimalist Purple Bar */}
      <footer className="p-4 sm:p-6 bg-white border-t border-slate-100 flex justify-center">
        <div className="w-full max-w-4xl relative">
          <form 
            onSubmit={handleSendText} 
            className="flex items-end gap-3 p-2 bg-slate-50 border border-slate-200 rounded-2xl focus-within:border-purple-500 focus-within:bg-white transition-all shadow-sm"
          >
            {/* Attachment Button */}
            <label className={`p-3 rounded-xl cursor-pointer transition-colors flex-shrink-0 ${isSending ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'}`}>
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isSending || !sendMsgAction}
              />
              <Paperclip size={22} strokeWidth={2} />
            </label>
            
            {/* Text Input */}
            <div className="flex-1 pb-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isConnected ? "Ketik pesan atau lampirkan file..." : "Menunggu device lain bergabung..."}
                disabled={!sendMsgAction}
                className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 text-sm sm:text-base py-2 px-1 focus:outline-none focus:ring-0"
              />
            </div>
            
            {/* Send Button */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !isSending) || !sendMsgAction}
              className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex-shrink-0"
            >
              {isSending ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} strokeWidth={2} />}
            </button>
          </form>
          
          {!isConnected && (
            <div className="absolute -top-10 left-0 right-0 text-center">
              <span className="inline-block bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full shadow-md animate-pulse">
                Menunggu device lain terhubung ke Void...
              </span>
            </div>
          )}
        </div>
      </footer>

    </div>
  );
}
