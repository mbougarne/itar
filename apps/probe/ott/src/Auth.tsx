import React, {useEffect, useRef, useState} from 'react';
import {BackHandler, Keyboard, Text, TextInput, View} from 'react-native';
import {FocusScope, occurrenceKey, useFocusCommands, useFocusReady} from 'itar/react';
import {Action} from './ui';
import {useDesign} from './theme';
export default function Auth({onSignIn}: {onSignIn: () => void}) {
  const {s, u} = useDesign();const [form, setForm] = useState<'Sign in' | 'Sign up' | null>(null);
  const [email, setEmail] = useState('');const [password, setPassword] = useState('');
  const [editing, setEditing] = useState<'email' | 'password' | null>(null);
  const lastField = useRef<'email' | 'password'>('email');
  const emailInput = useRef<TextInput>(null);const passwordInput = useRef<TextInput>(null);
  const commands = useFocusCommands();const ready = useFocusReady();
  useEffect(() => {
    if (!ready || editing) { return; }
    const request = commands.focusByKey(occurrenceKey('auth', form ? lastField.current : 'signin'));return () => request.cancel();
  }, [commands, ready, form, editing]);
  useEffect(() => { const listener = Keyboard.addListener('keyboardDidHide', () => setEditing(null));return () => listener.remove(); }, []);
  useEffect(() => {
    if (editing) { (editing === 'email' ? emailInput : passwordInput).current?.focus(); }
  }, [editing]);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editing) { setEditing(null);return true; }
      if (form) { setForm(null);return true; }
      return false;
    });return () => handler.remove();
  }, [form, editing]);
  return <FocusScope id="welcome" layout="spatial" style={s.auth}>
    <Text style={s.splashBrand}><Text style={s.brandStrong}>ITAR</Text> CINEMA</Text>
    <Text style={s.heroTitle}>{form || 'A world of stories.'}</Text>
    <Text style={s.body}>{form ? 'Demo account · Any email and password will work.' : 'Find your next favourite. Explore films, series and what’s on TV.'}</Text>
    {form ? <>
      {(['email', 'password'] as const).map(field => <View key={field}>
        <Text style={s.muted}>{field === 'email' ? 'Email' : 'Password'}</Text>
        {editing === field ? <TextInput ref={field === 'email' ? emailInput : passwordInput} style={s.authInput} accessibilityLabel={field === 'email' ? 'Email' : 'Password'}
          value={field === 'email' ? email : password} onChangeText={field === 'email' ? setEmail : setPassword} secureTextEntry={field === 'password'}
          keyboardType={field === 'email' ? 'email-address' : 'default'} autoCapitalize="none" autoCorrect={false} returnKeyType="done" submitBehavior="blurAndSubmit" maxLength={120}
          onBlur={() => setEditing(null)} onSubmitEditing={() => setEditing(null)} /> :
          <Action id={occurrenceKey('auth', field)} label={`Edit ${field}`} displayLabel={field === 'email' ? email || 'Enter any email' : password ? '••••••••' : 'Enter any password'}
            onPress={() => { lastField.current = field;setEditing(field); }} style={s.authInput} />}
      </View>)}
      <FocusScope id="auth-actions" layout="row" boundary="parent" style={s.row}>
        <Action id={occurrenceKey('auth', 'submit')} label={form} onPress={onSignIn} style={[s.primaryCta, {width: 640 * u}]} />
        <Action order={1} id={occurrenceKey('auth', 'back')} label="Back" onPress={() => setForm(null)} />
      </FocusScope>
      <Text style={s.footer}>No account is created. These values stay in memory and are never sent or saved.</Text>
    </> : <FocusScope id="welcome-actions" layout="row" boundary="parent" style={s.heroActions}>
      <Action id={occurrenceKey('auth', 'signin')} label="Sign in" onPress={() => setForm('Sign in')} style={s.primaryCta} />
      <Action order={1} id={occurrenceKey('auth', 'signup')} label="Sign up" onPress={() => setForm('Sign up')} style={s.primaryCta} />
    </FocusScope>}
  </FocusScope>;
}
