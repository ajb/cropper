import React from 'react';
import { each } from 'lodash'

export default function FileBase64 ({accept, maxSize, multiple, onDone, id, className}) {
  function filePassesValidation(file) {
    return file.size < maxSize
  }

  function handleChange(e) {
    e.persist()

    let files = e.target.files
    let processedFiles = []
    let rejectedFiles = []

    each(files, (file) => {
      let reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (filePassesValidation(file)) {
          processedFiles.push({
            name: file.name,
            type: file.type,
            size: Math.round(file.size / 1000) + ' kB',
            base64: reader.result,
            file: file,
          })
        } else {
          rejectedFiles.push(file.name)
        }

        if ((processedFiles.length + rejectedFiles.length) === files.length) {
          onDone(processedFiles, rejectedFiles, e)
        }
      }
    })
  }

  return (
    <input
      id={id}
      className={className}
      type='file'
      accept={accept}
      onChange={handleChange}
      multiple={multiple} />
  )
}

FileBase64.defaultProps = {
  accept: '.png,.jpg',
  maxSize: 500000
}
