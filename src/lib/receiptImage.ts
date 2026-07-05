import * as ImageManipulator from 'expo-image-manipulator';

/** Сжимает фото чека перед отправкой в OCR — быстрее загрузка и распознавание. */
export async function prepareReceiptImageBase64(imageUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 960 } }],
    {
      compress: 0.48,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!result.base64) {
    throw new Error('Не удалось сжать фото чека.');
  }

  return result.base64;
}
