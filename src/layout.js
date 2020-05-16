import React, { useState, useEffect, useRef } from 'react'
import styles from './layout.module.css'

export function MainContainer(props) {
  return (
    <div>
      {props.children}
    </div>
  )
}

export function FlexContainer(props) {
  return (
    <div className='lg-flex pt2'>
      {props.children}
    </div>
  )
}

export function LeftColumn({sticky, children}) {
  const el = useRef()
  const [maxHeight, setMaxHeight] = useState('none')

  useEffect(() => {
    function calculateMaxHeight() {
      // Only in desktop view
      if (window.innerWidth >= 1024) {
        if (sticky) {
          setMaxHeight(window.innerHeight - 15)
        } else {
          setMaxHeight(window.innerHeight - el.current.offsetTop - 15)
        }
      } else {
        setMaxHeight('none')
      }
    }

    calculateMaxHeight()
    window.addEventListener('resize', calculateMaxHeight)
    return () => {
      window.removeEventListener('resize', calculateMaxHeight)
    }
  }, [sticky])

  return (
    <div
      className={`lg-col-3 lg-pr3 pb2 ${sticky ? styles.StickyColumn : ''}`}
      style={{maxHeight: maxHeight, overflowY: 'scroll'}}
      ref={el}
    >
      {children}
    </div>
  )
}

export function RightColumn(props) {
  return (
    <div className='flex-auto lg-col-9'>
      {props.children}
    </div>
  )
}
