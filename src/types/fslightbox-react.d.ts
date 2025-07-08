declare module 'fslightbox-react' {
  interface FsLightboxProps {
    toggler: boolean
    sources: string[]
    slide?: number
    exitFullscreenOnClose?: boolean
    openOnMount?: boolean
  }

  const FsLightbox: React.ComponentType<FsLightboxProps>
  export default FsLightbox
}