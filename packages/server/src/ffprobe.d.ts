// @ffprobe-installer/ffprobe не поставляет собственные типы — объявляем минимально.
declare module '@ffprobe-installer/ffprobe' {
  const ffprobe: {path: string; version: string; url: string};
  export = ffprobe;
}
