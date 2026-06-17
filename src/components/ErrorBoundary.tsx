import { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>!</Text>
          <Text style={styles.title}>出错了</Text>
          <Text style={styles.msg}>{this.state.error?.message ?? '未知错误'}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.handleReset}>
            <Text style={styles.btnText}>重试</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 32 },
  icon: { fontSize: 48, color: '#E74C3C', fontWeight: '700', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  msg: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#07C160', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
