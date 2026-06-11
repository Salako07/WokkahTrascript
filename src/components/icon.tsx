import React from 'react';
import { Ionicons } from '@expo/vector-icons';

const ICON_MAP: Record<string, string> = {
  'doc.text.fill': 'document-text',
  'doc.text': 'document-text-outline',
  'mic.circle.fill': 'mic-circle',
  'mic.circle': 'mic-circle-outline',
  'arrow.up.circle.fill': 'arrow-up-circle',
  'arrow.up.circle': 'arrow-up-circle-outline',
  'gearshape.fill': 'settings',
  'magnifyingglass': 'search',
  'xmark.circle.fill': 'close-circle',
  'mic.fill': 'mic',
  'stop.fill': 'stop-circle',
  'waveform': 'pulse',
  'waveform.circle.fill': 'pulse',
  'arrow.down.circle': 'arrow-down-circle-outline',
  'text.word.spacing': 'document-text-outline',
  'checkmark.seal.fill': 'checkmark-done-circle',
  'square.and.arrow.down': 'save-outline',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark': 'checkmark',
  'key.fill': 'key',
  'info.circle': 'information-circle-outline',
  'arrow.up.doc.fill': 'cloud-upload',
  'arrow.down.doc': 'download-outline',
  'doc.on.doc': 'copy-outline',
  'trash': 'trash-outline',
  'circle': 'ellipse-outline',
  'list.bullet': 'list-outline',
  'arrow.clockwise': 'refresh-outline',
  'square.and.arrow.up': 'share-outline',
  'checkmark.circle': 'checkmark-circle-outline',
  'xmark.circle': 'close-circle-outline',
  'person.crop.circle': 'person-circle-outline',
  'cloud': 'cloud-outline',
};

interface IconProps {
  name: string;
  size: number;
  tintColor: string;
}

export function Icon({ name, size, tintColor }: IconProps) {
  const ionName = (ICON_MAP[name] ?? 'help-circle-outline') as any;
  return <Ionicons name={ionName} size={size} color={tintColor} />;
}
