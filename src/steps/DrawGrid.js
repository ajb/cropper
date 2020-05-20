import React, { Fragment, useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Stage, Layer, Image, Line, Rect } from 'react-konva'
import useImage from 'use-image'
import cuid from 'cuid'
import { map, flatten } from 'lodash'
import { FlexContainer, LeftColumn, RightColumn } from '../layout'
import { calculateIntersections } from '../reducers/cropper'

export default function DrawGrid() {
  const state = useSelector(s => s.cropper)
  const [hoveringObject, setHoveringObject] = useState(false)
  const dispatch = useDispatch()
  const [konvaImage] = useImage(state.image.base64)
  const stageContainer = useRef()

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyPress(e) {
      // Escape key exits from many actions...
      if (e.code === 'Escape') {
        if (state.drawingLineId) {
          dispatch({
            type: 'cropper/removeLine',
            payload: state.drawingLineId
          })

          dispatch({type: 'cropper/stopDrawing'})
        }

        if (state.drawingRectId) {
          dispatch({
            type: 'cropper/removeRect',
            payload: state.drawingRectId
          })

          dispatch({type: 'cropper/stopDrawing'})
        }

        if (state.sidebarLineId || state.sidebarRectId) {
          dispatch({type: 'cropper/closeSidebar'})
        }

        dispatch({type: 'cropper/setClickToDraw', payload: null})
      }

      // Other keys:
      if (e.target.nodeName === 'INPUT') return;
      if (e.metaKey) return;

      if (e.code === 'KeyL') dispatch({type: 'cropper/setClickToDraw', payload: 'line'});
      if (e.code === 'KeyR') dispatch({type: 'cropper/setClickToDraw', payload: 'rect'});
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => { document.removeEventListener('keydown', handleKeyPress) }
  }, [dispatch, state.drawingLineId, state.drawingRectId, state.sidebarLineId])

  useEffect(() => {
    function calculateScale() {
      if (!stageContainer.current) return;
      let scales = [1]
      let availableHeight = window.innerHeight - stageContainer.current.offsetTop
      let availableWidth = window.innerWidth - stageContainer.current.offsetLeft

      if (state.image.width > availableWidth) {
        scales.push(availableWidth / state.image.width)
      }

      if (state.image.height > availableHeight) {
        scales.push(availableHeight / state.image.height)
      }

      dispatch({type: 'cropper/setScale', payload: Math.min(...scales)})
    }
    calculateScale()

    window.addEventListener('resize', calculateScale)
    return () => { window.removeEventListener('resize', calculateScale) }
  }, [dispatch, state.image.width, state.image.height])

  useEffect(() => {
    if (state.clickToDraw || state.drawingLineId || state.drawingRectId) {
      setCursor('crosshair')
    } else if (hoveringObject) {
      setCursor('pointer')
    } else {
      setCursor('default')
    }
  }, [state.clickToDraw, state.drawingLineId, state.drawingRectId, hoveringObject])

  function setCursor(val) {
    stageContainer.current.style.cursor = val
  }

  function handleLineClick(line) {
    if (state.clickToDraw) return;

    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId: line.id }
    })
  }

  function handleRectClick(rect) {
    if (state.clickToDraw) return;

    dispatch({
      type: 'cropper/editRectInSidebar',
      meta: { rectId: rect.id }
    })
  }

  function createLine(startX, startY) {
    let lineId = cuid()

    dispatch({
      type: 'cropper/createLine',
      meta: { lineId },
      payload: {
        id: lineId,
        points: [[Math.round(startX / state.scale), Math.round(startY / state.scale)]],
        added: Date.now(),
        name: ''
      }
    })

    dispatch({
      type: 'cropper/startDrawingLine',
      meta: { lineId }
    })
  }

  function createRect(startX, startY) {
    let rectId = cuid()

    dispatch({
      type: 'cropper/createRect',
      meta: { rectId },
      payload: {
        id: rectId,
        points: [[Math.round(startX / state.scale), Math.round(startY / state.scale)]],
        added: Date.now()
      }
    })

    dispatch({
      type: 'cropper/startDrawingRect',
      meta: { rectId }
    })
  }

  function handleMouseMove(e) {
    if (state.drawingLineId) {
      dispatch({
        type: 'cropper/setLineFinish',
        meta: { lineId: state.drawingLineId },
        payload: [
          Math.round(e.evt.offsetX / state.scale),
          Math.round(e.evt.offsetY / state.scale)
        ]
      })
    }

    if (state.drawingRectId) {
      dispatch({
        type: 'cropper/setRectFinish',
        meta: { rectId: state.drawingRectId },
        payload: [
          Math.round(e.evt.offsetX / state.scale),
          Math.round(e.evt.offsetY / state.scale)
        ]
      })
    }
  }

  function handleClick(e) {
    if (state.drawingLineId) {
      finishLine(state.drawingLineId)
      dispatch({type: 'cropper/stopDrawing'})
    } else if (state.drawingRectId) {
      finishRect(state.drawingRectId)
      dispatch({type: 'cropper/stopDrawing'})
    } else if (state.clickToDraw === 'line') {
      createLine(e.evt.offsetX, e.evt.offsetY)
      dispatch({type: 'cropper/setClickToDraw', payload: null})
    } else if (state.clickToDraw === 'rect') {
      createRect(e.evt.offsetX, e.evt.offsetY)
      dispatch({type: 'cropper/setClickToDraw', payload: null})
    }
  }

  function finishLine(lineId) {
    let start = state.lines[lineId].points[0]
    let finish = state.lines[lineId].points[1]
    let len = Math.sqrt(Math.pow(start[0] - finish[0], 2) + Math.pow(start[1] - finish[1], 2))

    let addAmt = 0
    let stopAdding = false
    let newFinish

    while (!stopAdding) {
      addAmt++;

      newFinish = [
        Math.round(finish[0] + (finish[0] - start[0]) / len * addAmt),
        Math.round(finish[1] + (finish[1] - start[1]) / len * addAmt)
      ]

      if (newFinish[0] > state.image.width || newFinish[1] > state.image.height || newFinish[0] < 0 || newFinish[1] < 0) {
        stopAdding = true
      }
    }

    let removeAmt = 0
    let stopRemoving = false
    let newStart

    while (!stopRemoving) {
      removeAmt = removeAmt - 1

      newStart = [
        Math.round(finish[0] + (finish[0] - start[0]) / len * removeAmt),
        Math.round(finish[1] + (finish[1] - start[1]) / len * removeAmt)
      ]

      if (newStart[0] > state.image.width || newStart[1] > state.image.height || newStart[0] < 0 || newStart[1] < 0) {
        stopRemoving = true
      }
    }

    dispatch({
      type: 'cropper/finishLine',
      meta: { lineId },
      payload: {
        points: [newStart, newFinish]
      }
    })
  }

  function finishRect(rectId) {
    dispatch({
      type: 'cropper/finishRect',
      meta: { rectId }
    })
  }

  function nextStep() {
    dispatch(calculateIntersections()).then(() => {
      dispatch({
        type: 'cropper/setStep',
        payload: 'imageReview'
      })
    })
  }

  return (
    <FlexContainer>
      <LeftColumn sticky={true}>
        <div className='background-light-gray p2'>
          <button
            className='btn btn-small btn-primary'
            disabled={state.clickToDraw === 'line'}
            onClick={() => dispatch({type: 'cropper/setClickToDraw', payload: 'line'})}
          ><u>L</u>ine</button>

          &nbsp;

          <button
            className='btn btn-small btn-primary'
            disabled={state.clickToDraw === 'rect'}
            onClick={() => dispatch({type: 'cropper/setClickToDraw', payload: 'rect'})}
          ><u>R</u>ect</button>
        </div>

        <div className='py2'>
          {
            (state.drawingLineId || state.drawingRectId) ?
              <p className='h3 gray'>Drawing...</p> :
              (
                state.clickToDraw ?
                  <p className='h3 gray'>Click to draw {state.clickToDraw}</p> :
                  (
                    state.sidebarLineId && state.lines[state.sidebarLineId] ?
                      <SidebarLine /> :
                      (
                        state.sidebarRectId && state.rects[state.sidebarRectId] ?
                          <SidebarRect /> :
                          <SidebarAll />
                      )
                  )
              )
          }
        </div>

        <div className='background-light-gray p2'>
          <button className='btn btn-primary' onClick={nextStep}>Next step</button>

          <div className='h6 pt1'>
            <span className='link' onClick={() => window.location.reload()}>or start over</span>
          </div>
        </div>
      </LeftColumn>
      <RightColumn>
        <div ref={stageContainer}>
          <Stage
            width={window.innerWidth}
            height={window.innerHeight}
            scale={{x: state.scale, y: state.scale}}
            onContentMouseMove={handleMouseMove}
            onContentClick={handleClick}
          >
            <Layer>
              <Image
                image={konvaImage}
              />
            </Layer>

            <Layer>
              {map(state.lines, (line, id) => {
                if (line.points.length === 0) return null;

                return (
                  <Fragment key={id}>
                    <Line
                      points={flatten(line.points)}
                      stroke={'red'}
                      strokeWidth={2 / state.scale}
                      onClick={() => handleLineClick(line)}
                      onMouseenter={() => setHoveringObject(true)}
                      onMouseleave={() => setHoveringObject(false)}
                    />

                    <Line
                      points={flatten(line.points)}
                      stroke={'black'}
                      opacity={id === state.sidebarLineId ? 0.3 : 0}
                      strokeWidth={20 / state.scale}
                      onClick={() => handleLineClick(line)}
                      onMouseenter={() => setHoveringObject(true)}
                      onMouseleave={() => setHoveringObject(false)}
                    />
                  </Fragment>
                )
              })}

              {map(state.rects, (rect, id) => {
                if (rect.points.length < 2) return null;

                let width = Math.abs(rect.points[0][0] - rect.points[1][0])
                let height = Math.abs(rect.points[0][1] - rect.points[1][1])

                return (
                  <Rect
                    key={id}
                    x={rect.points[0][0]}
                    y={rect.points[0][1]}
                    width={width}
                    height={height}
                    fill={'red'}
                    opacity={id === state.sidebarRectId ? 0.8 : 0.5}
                    onClick={() => handleRectClick(rect)}
                    onMouseenter={() => setHoveringObject(true)}
                    onMouseleave={() => setHoveringObject(false)}
                  />
                )
              })}
            </Layer>
          </Stage>
        </div>
      </RightColumn>
    </FlexContainer>
  )
}

function SidebarLine() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()
  const line = state.lines[state.sidebarLineId]
  const nameInput = useRef()

  useEffect(() => {
    nameInput.current && nameInput.current.focus()
  }, [nameInput])

  function save() {
    dispatch({type: 'cropper/closeSidebar'})

    if (state.wasDrawing) {
      dispatch({type: 'cropper/drawAnother'})
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    save()
  }

  return (
    <Fragment>
      <form onSubmit={handleSubmit}>
        <label className='label'>Line name</label>
        <input
          className='input'
          type='text'
          ref={nameInput}
          value={line.name || ''}
          onChange={(e) => dispatch({type: 'cropper/setLineName', meta: { lineId: line.id }, payload: e.target.value})}
        />

        <button className='btn btn-small btn-primary'>Save</button>
        <div className='pt2'>
          <span
            className='link h6'
            onClick={() => {
              dispatch({type: 'cropper/removeLine', payload: line.id})
            }}
          >Delete line</span>
        </div>
      </form>
    </Fragment>
  )
}

function SidebarRect() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()
  const rect = state.rects[state.sidebarRectId]


  function save() {
    dispatch({type: 'cropper/closeSidebar'})
  }

  return (
    <Fragment>
      <label className='label'>Rect ID</label>
      <input
        className='input'
        readonly
        disabled
        type='text'
        value={rect.id}
      />

      <button className='btn btn-small btn-primary' onClick={save}>Save</button>
      <div className='pt2'>
        <span
          className='link h6'
          onClick={() => {
            dispatch({type: 'cropper/removeRect', payload: rect.id})
          }}
        >Delete rect</span>
      </div>
    </Fragment>
  )
}

function SidebarAll() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()

  function editLine(id) {
    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId: id }
    })
  }

  function editRect(id) {
    dispatch({
      type: 'cropper/editRectInSidebar',
      meta: { rectId: id }
    })
  }

  return (
    <Fragment>
      <h4 className='my0'>Lines</h4>
      <ul>
        {map(state.lines, (line, id) => {
          return <li key={id}><span className='link' onClick={() => editLine(id)}>{line.name || 'Unnamed line'}</span></li>
        })}
      </ul>
      <h4 className='my0'>Rects</h4>
      <ul>
        {map(state.rects, (rect, id) => {
          return <li key={id}><span className='link' onClick={() => editRect(id)}>{rect.id}</span></li>
        })}
      </ul>
    </Fragment>
  )
}
