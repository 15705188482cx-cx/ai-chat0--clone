import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "会话",
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "设置",
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
