import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_STORAGE_KEY = '@matches:favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // 1. Загрузка сохранённых данных при старте
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const stored = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load favorites', e);
      } finally {
        setIsHydrated(true);
      }
    };
    loadFavorites();
  }, []);

  // 2. Сохранение при каждом изменении
  useEffect(() => {
    if (!isHydrated) return; // Ждём, пока загрузятся старые данные
    const saveFavorites = async () => {
      try {
        await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
      } catch (e) {
        console.error('Failed to save favorites', e);
      }
    };
    saveFavorites();
  }, [favorites, isHydrated]);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  const toggle = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  return { favorites, isFavorite, toggle };
}