import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StepperNav from './components/StepperNav';
import ConnectionView from './components/ConnectionView';
import SendMessageView from './components/SendMessageView';
import TransferringView from './components/TransferringView';
import ResultsView from './components/ResultsView';
import HistoryView from './components/HistoryView';
import ProtocolLayersView from './components/ProtocolLayersView';
import ArchitectureDesignView from './components/ArchitectureDesignView';
import DeepStudioSidebar from './components/DeepStudioSidebar';
import PacketModal from './components/PacketModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([1]); // step 1 starts connected / completed

  // Networking Configuration
  const [config, setConfig] = useState({
    senderIp: '192.168.1.101',
    receiverIp: '192.168.1.102',
    port: '9999',
    apiUrl: 'http://localhost:8080'
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectPacket, setInspectPacket] = useState(null);

  // Stack State & Sequence Numbers
  const [senderSeq, setSenderSeq] = useState(10001);
  const [receiverSeq, setReceiverSeq] = useState(50001);
  const [stackStatus, setStackStatus] = useState('ESTABLISHED');

  // Transfers and Current In-Flight Transfer
  const [currentTransfer, setCurrentTransfer] = useState(null);
  const [transfers, setTransfers] = useState([
    {
      id: 1,
      message: 'SYN / Initial Handshake',
      bytes: 0,
      seq: 10000,
      ack: 50001,
      sentTime: '2026-10-22 01:15:00.000',
      recvTime: '2026-10-22 01:15:00.023',
      rtt: '23.1 ms',
      status: 'Connected'
    }
  ]);

  // Optional: Poll C Telemetry server if alive
  useEffect(() => {
    let interval = setInterval(async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/status`, { mode: 'cors' });
        if (res.ok) {
          const data = await res.json();
          if (data.status) setStackStatus(data.status);
          if (data.senderSeq) setSenderSeq(data.senderSeq);
          if (data.receiverSeq) setReceiverSeq(data.receiverSeq);
        }
      } catch {
        // Backend not currently running; UI works seamlessly via interactive simulation
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [config.apiUrl]);

  // Action: User clicks Continue on Step 1 Connection View
  const handleContinueFromConnection = () => {
    setCompletedSteps((prev) => Array.from(new Set([...prev, 1])));
    setActiveStep(2);
  };

  // Action: User clicks Send Message on Step 2 (supports Client -> Server and Server -> Client)
  const handleSendMessage = async (messageText, direction = 'client_to_server') => {
    const bytes = new TextEncoder().encode(messageText).length;
    const now = new Date();
    const sentTime = now.toISOString().replace('T', ' ').slice(0, 23);
    const isServer = direction === 'server_to_client';

    const activeSeq = isServer ? receiverSeq : senderSeq;
    const activeAck = isServer ? senderSeq : receiverSeq;

    const newTransfer = {
      id: Date.now(),
      direction: direction,
      message: messageText,
      bytes: bytes,
      seq: activeSeq,
      ack: activeAck,
      sentTime: sentTime,
      recvTime: null,
      rtt: '23.4 ms',
      status: 'In Flight'
    };

    setCurrentTransfer(newTransfer);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
    setActiveStep(3); // Go to Transferring view

    // Trigger real backend transmission if telemetry_server is running
    try {
      const res = await fetch(`${config.apiUrl}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: isServer ? 'server' : 'client',
          message: messageText,
          seq: activeSeq,
          ack: activeAck
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.senderSeq) setSenderSeq(data.senderSeq);
        if (data.receiverSeq) setReceiverSeq(data.receiverSeq);
      }
    } catch {
      // Backend not currently running; interactive simulation maintains seamless full-stack demo
    }
  };

  // Action: Animation finishes on Step 3 Transferring View
  const handleTransferComplete = () => {
    if (!currentTransfer) return;

    const now = new Date();
    const recvTime = now.toISOString().replace('T', ' ').slice(0, 23);
    const updatedTransfer = {
      ...currentTransfer,
      recvTime: recvTime,
      status: 'Delivered',
      totalCount: transfers.length + 1
    };

    // Advance sequence numbers for simulated state (if not already updated by API)
    if (updatedTransfer.direction === 'server_to_client') {
      setReceiverSeq((prev) => (prev <= updatedTransfer.seq ? prev + updatedTransfer.bytes : prev));
    } else {
      setSenderSeq((prev) => (prev <= updatedTransfer.seq ? prev + updatedTransfer.bytes : prev));
    }

    setCurrentTransfer(updatedTransfer);
    setTransfers((prev) => [updatedTransfer, ...prev]);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 3, 4])));
    setActiveStep(4); // Advance to Success / Results View
  };

  // Action: User clicks Send Another Message on Step 4
  const handleSendAgain = () => {
    setActiveStep(2);
  };

  // Action: User clicks View History on Step 4 or Stepper
  const handleViewHistory = () => {
    setCompletedSteps((prev) => Array.from(new Set([...prev, 5])));
    setActiveStep(5);
  };

  // Action: User clicks Clear Log in History
  const handleClearHistory = () => {
    setTransfers([]);
  };

  return (
    <div className="app-container">
      {/* SINGLE COMBINED WHITE MASTER CARD */}
      <div className="unified-card">
        {/* Sticky Top Navigation Bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
          <Header
            senderIp={config.senderIp}
            receiverIp={config.receiverIp}
            port={config.port}
            status={stackStatus}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <StepperNav
            activeStep={activeStep}
            completedSteps={completedSteps}
            onSelectStep={(step) => setActiveStep(step)}
          />
        </div>

        {/* 3. Dual-Column Workspace: Fixed Deep Studio Sidebar + Main Dynamic View */}
        <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 128px)', background: '#FFFFFF' }}>
          <DeepStudioSidebar
            activeStep={activeStep}
            onSelectStep={(step) => setActiveStep(step)}
            transfersCount={transfers.length}
            senderSeq={senderSeq}
            receiverSeq={receiverSeq}
            stackStatus={stackStatus}
            onInspectLastPacket={() => setInspectPacket(currentTransfer || transfers[0])}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <main className="unified-main-content" style={{ flex: 1, overflowX: 'hidden' }}>
            {activeStep === 1 && (
              <ConnectionView
                senderIp={config.senderIp}
                receiverIp={config.receiverIp}
                onContinue={handleContinueFromConnection}
              />
            )}

            {activeStep === 2 && (
              <SendMessageView
                senderIp={config.senderIp}
                receiverIp={config.receiverIp}
                senderSeq={senderSeq}
                receiverSeq={receiverSeq}
                onSend={handleSendMessage}
                onRefreshSeq={() => {
                  setSenderSeq((s) => s + 100);
                  setReceiverSeq((r) => r + 100);
                }}
              />
            )}

            {activeStep === 3 && (
              <TransferringView
                senderIp={config.senderIp}
                receiverIp={config.receiverIp}
                currentTransfer={currentTransfer}
                onComplete={handleTransferComplete}
                onOpenLayers={() => setActiveStep(6)}
              />
            )}

            {activeStep === 4 && (
              <ResultsView
                transfer={currentTransfer || transfers[0]}
                senderIp={config.senderIp}
                receiverIp={config.receiverIp}
                onSendAgain={handleSendAgain}
                onViewHistory={handleViewHistory}
                onInspectPacket={(t) => setInspectPacket(t)}
                onViewLayers={() => setActiveStep(6)}
              />
            )}

            {activeStep === 5 && (
              <HistoryView
                transfers={transfers}
                onInspectPacket={(item) => setInspectPacket(item)}
                onNewTransfer={() => setActiveStep(2)}
                onClearHistory={handleClearHistory}
              />
            )}

            {activeStep === 6 && (
              <ProtocolLayersView
                payload={currentTransfer?.message || 'Hello World!'}
                seq={currentTransfer?.seq || senderSeq}
                ack={currentTransfer?.ack || receiverSeq}
                senderIp={config.senderIp}
                receiverIp={config.receiverIp}
                port={config.port}
              />
            )}

            {activeStep === 7 && (
              <ArchitectureDesignView />
            )}
          </main>
        </div>
      </div>

      {/* Modals */}
      <PacketModal
        packet={inspectPacket}
        onClose={() => setInspectPacket(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        config={config}
        onSave={(newCfg) => setConfig((prev) => ({ ...prev, ...newCfg }))}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
