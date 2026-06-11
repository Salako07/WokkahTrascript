import React from 'react';
import { SymbolView } from 'expo-symbols';

interface IconProps {
  name: string;
  size: number;
  tintColor: string;
}

const SYMBOL_ALIASES: Record<string, string> = {
  'circle': 'circle',
  'list.bullet': 'list.bullet',
  'arrow.clockwise': 'arrow.clockwise',
};

export function Icon({ name, size, tintColor }: IconProps) {
  return <SymbolView name={(SYMBOL_ALIASES[name] ?? name) as any} size={size} tintColor={tintColor} />;
}
