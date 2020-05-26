import React from 'react'
import { useDispatch } from 'react-redux'
import FileBase64 from '../FileBase64'

export default function UploadImage() {
  const dispatch = useDispatch()

  return (
    <FileBase64
      maxSize={5000000}
      multiple={false}
      onDone={(processed, rejected, e) => {
        let img = document.createElement('img')
        img.src = processed[0].base64

        img.addEventListener('load', () => {
          dispatch({
            type: 'cropper/loadImage',
            payload: {
              base64: processed[0].base64,
              width: img.width,
              height: img.height
            }
          })

          dispatch({
            type: 'cropper/setStep',
            payload: 'drawGrid'
          })
        })
      }}
    />
  )
}
