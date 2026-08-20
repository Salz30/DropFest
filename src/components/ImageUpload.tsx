import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { UploadCloud, Loader2, X } from 'lucide-react'

interface ImageUploadProps {
  bucket: string
  folder: string
  currentUrl?: string | null
  onUpload: (url: string) => void
  label?: string
  maxSizeMB?: number
  aspectHint?: string
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  bucket,
  folder,
  currentUrl,
  onUpload,
  label = 'Unggah Gambar',
  maxSizeMB = 5,
  aspectHint
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Ukuran file maksimal ${maxSizeMB}MB`)
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Format harus JPG, PNG, WEBP, atau GIF')
      return
    }

    setIsUploading(true)
    setError(null)

    // Generate local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const random = Math.random().toString(36).substring(2, 8)
      const filename = `${folder}/${Date.now()}_${random}.${ext}`

      // Try uploading to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filename)
        const publicUrl = publicUrlData.publicUrl
        setPreview(publicUrl)
        onUpload(publicUrl)
      } else {
        // Fallback to Data URL if Storage bucket is not yet configured in Supabase
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          setPreview(dataUrl)
          onUpload(dataUrl)
        }
        reader.readAsDataURL(file)
      }
    } catch {
      // Fallback to Data URL
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        setPreview(dataUrl)
        onUpload(dataUrl)
      }
      reader.readAsDataURL(file)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
    onUpload('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label className="input-label" style={{ fontWeight: 600, color: '#3D464D', display: 'flex', justifyContent: 'space-between' }}>
          <span>{label}</span>
          {aspectHint && <span style={{ color: '#75797C', fontSize: '11px', fontWeight: 400 }}>Rasio ideal: {aspectHint}</span>}
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {preview ? (
        <div style={{
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #D9D9D9',
          background: '#1A0F3D',
          maxHeight: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={preview}
            alt="Preview"
            style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }}
          />
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 6,
          }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'rgba(41,22,94,0.85)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              Ganti Foto
            </button>
            <button
              type="button"
              onClick={handleRemove}
              style={{
                background: 'rgba(211,47,47,0.85)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
              title="Hapus foto"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            if (!isUploading) fileInputRef.current?.click()
          }}
          style={{
            border: '2px dashed #CBD5E1',
            borderRadius: 8,
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            textAlign: 'center',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#29165E'
            e.currentTarget.style.backgroundColor = '#F0F3FF'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#CBD5E1'
            e.currentTarget.style.backgroundColor = '#F8FAFC'
          }}
        >
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#29165E' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Mengunggah foto...</span>
            </div>
          ) : (
            <>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                background: '#E7E3FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
                color: '#29165E',
              }}>
                <UploadCloud size={22} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#29165E', margin: '0 0 2px' }}>
                Klik untuk upload foto langsung
              </p>
              <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>
                Format JPG, PNG, atau WEBP (Maksimal {maxSizeMB}MB)
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <span style={{ fontSize: 11, color: '#D32F2F', fontWeight: 600 }}>
          {error}
        </span>
      )}
    </div>
  )
}

export default ImageUpload
