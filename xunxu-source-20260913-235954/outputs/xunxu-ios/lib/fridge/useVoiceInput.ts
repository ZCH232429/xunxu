import {useEffect, useRef, useState} from 'react';
import {AppState, Platform} from 'react-native';
import Constants from 'expo-constants';
import type {ExpoSpeechRecognitionModule} from 'expo-speech-recognition';

export function useVoiceInput(active: boolean, onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const module = useRef<typeof ExpoSpeechRecognitionModule | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0), inFlight = useRef(false);
  const removers = useRef<Array<{remove(): void}>>([]);
  const callback = useRef(onTranscript); callback.current = onTranscript;
  const cancel = () => {
    clearTimeout(startTimer.current);
    generation.current++; inFlight.current = false;
    removers.current.forEach(s => s.remove()); removers.current = [];
    module.current?.abort(); module.current = null;
    setStarting(false); setListening(false);
  };
  useEffect(() => {
    if (!active) cancel();
    const subscription = AppState.addEventListener('change', state => {if (state !== 'active' && module.current) cancel();});
    return () => {subscription.remove(); cancel();};
  }, [active]);
  async function toggle() {
    if (!active) return;
    if (listening) {module.current?.stop(); return;}
    if (inFlight.current) return;
    setMessage('');
    // Expo Go cannot load this native module. Do not import it or pretend to record.
    if (Platform.OS !== 'web' && Constants.executionEnvironment === 'storeClient') {
      setMessage('Expo Go 请使用键盘右下角的麦克风听写。输入条直接语音识别需要安装循序开发构建。');
      return;
    }
    inFlight.current = true; setStarting(true);
    const current = ++generation.current;
    try {
      const speech = (await import('expo-speech-recognition')).ExpoSpeechRecognitionModule;
      if (current !== generation.current) return;
      if (!speech.isRecognitionAvailable()) throw Error('此设备或浏览器不支持语音识别，请使用键盘听写。');
      const permission = await speech.requestPermissionsAsync();
      if (current !== generation.current) return;
      if (!permission.granted) throw Error('请在系统设置中允许循序使用麦克风和语音识别。');
      removers.current.forEach(s => s.remove());
      module.current = speech;
      removers.current = [
        speech.addListener('start', () => {if (current === generation.current) {clearTimeout(startTimer.current); setStarting(false); setListening(true);}}),
        speech.addListener('result', event => {if (current === generation.current && event.results[0]) callback.current(event.results[0].transcript);}),
        speech.addListener('error', event => {if (current === generation.current) {setMessage(event.error === 'no-speech' ? '没有听清，请再试一次。' : '语音识别未完成，请检查麦克风权限或网络后重试。'); clearTimeout(startTimer.current); setListening(false); setStarting(false); inFlight.current = false;}}),
        speech.addListener('end', () => {if (current === generation.current) {clearTimeout(startTimer.current); setListening(false); setStarting(false); inFlight.current = false;}}),
      ];
      startTimer.current = setTimeout(() => {if (current === generation.current) {cancel(); setMessage('麦克风未能启动，请重试或使用键盘听写。');}}, 12000);
      speech.start({lang: 'zh-CN', interimResults: true, continuous: false});
    } catch (error) {
      if (current === generation.current) {cancel(); setMessage(error instanceof Error ? error.message : '语音识别不可用，请使用键盘听写。');}
    }
  }
  return {listening, starting, message, toggle, cancel};
}
