import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import UploadImage from './steps/UploadImage'
import DrawGrid from './steps/DrawGrid'
import ImageReview from './steps/ImageReview'

const localstorageKey = process.env.NODE_ENV !== 'production' && process.env.REACT_APP_STATE_KEY

export default function Cropper() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()

  // Development: save state
  useEffect(() => {
    if (!localstorageKey) return;
    let savedState = JSON.parse(localStorage.getItem(localstorageKey))
    if (savedState) dispatch({type: 'cropper/restoreState', payload: savedState});
  }, [dispatch])
  useEffect(() => {
    if (localstorageKey && state) localStorage.setItem(localstorageKey, JSON.stringify(state));
  }, [state])
  // End state save

  // Always prompt beforeunload
  useEffect(() => {
    window.addEventListener("beforeunload", function (e) {
      e.preventDefault()
      e.returnValue = ''
    })
  }, [])

  const clearLocalstorage = () => {
    if (!localstorageKey) return;
    localStorage.removeItem(localstorageKey)
  }

  // Render steps
  return (
    <div className='p2'>
      {state.step === 'uploadImage' && <UploadImage />}
      {state.step === 'drawGrid' && <DrawGrid clearLocalstorage={clearLocalstorage} />}
      {state.step === 'imageReview' && <ImageReview />}
    </div>
  )
}
