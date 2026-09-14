import React, {forwardRef, useEffect, useRef, useState} from 'react';
import {Animated, Easing, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import Svg, {Path, Rect} from 'react-native-svg';

export type InputTarget = 'food' | 'supplement';
export interface OmniInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  target: InputTarget;
  listening?: boolean;
  disabled?: boolean;
  onAddPress: () => void;
  onModeSelectPress: () => void;
  onVoicePress: () => void;
  onSend: () => void;
}

/** Presentation only: permission, recording, images and persistence belong to the caller. */
export const OmniInputBar = forwardRef<TextInput, OmniInputBarProps>(function OmniInputBar(
  {value, onChangeText, target, listening = false, disabled = false, onAddPress, onModeSelectPress, onVoicePress, onSend}, ref,
) {
  const [focused, setFocused] = useState(false);
  const send = !!value.trim() && !listening;
  const transition = useRef(new Animated.Value(send ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(transition, {toValue: send ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true});
    animation.start();
    return () => animation.stop();
  }, [send, transition]);
  return <View style={[styles.bar, focused && styles.focused, disabled && {opacity: .55}]}>
    <Pressable accessibilityRole="button" accessibilityLabel="添加照片或扫描条码" disabled={disabled || listening} onPress={onAddPress} style={styles.iconButton}>
      <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke="#eee" strokeWidth={1.8} strokeLinecap="round"/></Svg>
    </Pressable>
    <View style={{flex: 1, minWidth: 0}}>
      {listening && <Text accessibilityLiveRegion="polite" style={styles.listening}>正在聆听… 再点停止</Text>}
      <TextInput ref={ref} accessibilityLabel="描述要录入的食材或补剂" value={value} onChangeText={onChangeText}
        placeholder={target === 'food' ? '输入食材和克重…' : '输入补剂名称…'} placeholderTextColor="#aaa"
        editable={!disabled && !listening} style={styles.input} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        returnKeyType="send" onSubmitEditing={() => {if (send && !disabled) onSend();}} maxLength={2000}/>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="选择录入目标" disabled={disabled || listening} onPress={onModeSelectPress} style={styles.mode}>
      <Text style={styles.modeText}>{target === 'food' ? '冰箱' : '补剂'}</Text>
      <Svg width={12} height={12} viewBox="0 0 12 12"><Path d="m3 4.5 3 3 3-3" fill="none" stroke="#ccc" strokeWidth={1.5}/></Svg>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={listening ? '停止语音输入' : send ? '发送录入内容' : '开始语音输入'} disabled={disabled}
      onPress={send ? onSend : onVoicePress} style={[styles.iconButton, send && {backgroundColor: '#eee'}, listening && {backgroundColor: '#444'}]}>
      <Animated.View pointerEvents="none" style={[styles.glyph, {opacity: transition.interpolate({inputRange: [0, 1], outputRange: [1, 0]})}]}>
        <Svg width={23} height={23} viewBox="0 0 24 24">{listening ? <Rect x={6} y={6} width={12} height={12} rx={3} fill="#fff"/> : <><Rect x={9} y={3} width={6} height={12} rx={3} stroke="#eee" strokeWidth={1.8} fill="none"/><Path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M9 22h6" stroke="#eee" strokeWidth={1.8} fill="none" strokeLinecap="round"/></>}</Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.glyph, {opacity: transition, transform: [{scale: transition.interpolate({inputRange: [0, 1], outputRange: [.7, 1]})}]}]}>
        <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M12 19V5m-6 6 6-6 6 6" stroke="#111" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"/></Svg>
      </Animated.View>
    </Pressable>
  </View>;
});

const styles = StyleSheet.create({
  bar: {backgroundColor: '#1e1e1e', borderRadius: 9999, borderWidth: 1, borderColor: 'transparent', padding: 6, flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 2},
  focused: {borderColor: 'rgba(255,255,255,0.2)'},
  iconButton: {width: 44, height: 44, borderRadius: 9999, alignItems: 'center', justifyContent: 'center'},
  input: {color: '#f5f5f5', fontSize: 16, paddingVertical: 10, paddingHorizontal: 4, backgroundColor: 'transparent', borderWidth: 0, fontFamily: 'PingFang SC'},
  mode: {minHeight: 44, flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 6},
  modeText: {color: '#ddd', fontSize: 13, fontFamily: 'PingFang SC'},
  listening: {color: '#d7ff7a', fontSize: 11, paddingLeft: 4},
  glyph: {position: 'absolute', alignItems: 'center', justifyContent: 'center'},
});
