import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

type Props = {
  since: Date;
};

export function UpdatedAgo({ since }: Props) {
  const calc = () =>
    Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));

  const [seconds, setSeconds] = useState(calc);

  useEffect(() => {
    setSeconds(calc());
    const id = setInterval(() => setSeconds(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since]);

  return <Text style={styles.text}>Обновлено {seconds} сек назад</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    color: '#6b7280',
  },
});