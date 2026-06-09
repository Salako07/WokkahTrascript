import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: '#1c1c1e',
        },
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#52525b',
        headerStyle: { backgroundColor: '#111111' },
        headerTintColor: '#ffffff',
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Transcripts',
          tabBarIcon: ({ color, focused }) => (
            <SymbolView
              name={focused ? 'doc.text.fill' : 'doc.text'}
              size={22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color, focused }) => (
            <SymbolView
              name={focused ? 'mic.circle.fill' : 'mic.circle'}
              size={22}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, focused }) => (
            <SymbolView
              name={focused ? 'arrow.up.circle.fill' : 'arrow.up.circle'}
              size={22}
              tintColor={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
