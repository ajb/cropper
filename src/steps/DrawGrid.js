import React, { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Stage, Layer, Image, Line, Rect } from 'react-konva'
import useImage from 'use-image'
import cuid from 'cuid'
import { map, flatten, maxBy, values } from 'lodash'
import { FlexContainer, LeftColumn, RightColumn } from '../layout'
import { calculateIntersections } from '../reducers/cropper'

export default function DrawGrid() {
  const state = useSelector(s => s.cropper)
  const [hoveringLine, setHoveringLine] = useState(false)
  const dispatch = useDispatch()
  const [konvaImage] = useImage(state.image.base64)
  const stageContainer = useRef()

  const removeLast = useCallback(() => {
    let removeLine = maxBy(values(state.lines), 'added')
    let removeId = removeLine && removeLine.id
    if (removeId) dispatch({type: 'cropper/removeLine', payload: removeId});
  }, [dispatch, state.lines])

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

        if (state.sidebarLineId) {
          dispatch({type: 'cropper/closeSidebar'})
        }

        dispatch({type: 'cropper/setClickToDrawLine', payload: false})
      }

      // Other keys:
      if (e.target.nodeName === 'INPUT') return;
      if (e.metaKey) return;

      if (e.code === 'KeyN') dispatch({type: 'cropper/setClickToDrawLine', payload: true});
      if (e.code === 'KeyR') removeLast();
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => { document.removeEventListener('keydown', handleKeyPress) }
  }, [dispatch, removeLast, state.drawingLineId, state.sidebarLineId])

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
    if (state.clickToDrawLine || state.drawingLineId) {
      setCursor('crosshair')
    } else if (hoveringLine) {
      setCursor('pointer')
    } else {
      setCursor('default')
    }
  }, [state.clickToDrawLine, state.drawingLineId, hoveringLine])

  function setCursor(val) {
    stageContainer.current.style.cursor = val
  }

  function handleLineClick(line) {
    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId: line.id }
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
      type: 'cropper/startDrawing',
      meta: { lineId }
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
  }

  function handleClick(e) {
    if (state.drawingLineId) {
      finishLine(state.drawingLineId)
      dispatch({type: 'cropper/stopDrawing'})
    } else if (state.clickToDrawLine) {
      createLine(e.evt.offsetX, e.evt.offsetY)
      dispatch({type: 'cropper/setClickToDrawLine', payload: false})
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
      type: 'cropper/replaceLinePoints',
      meta: { lineId },
      payload: [newStart, newFinish]
    })

    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId }
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
            className='btn btn-small btn-secondary'
            disabled={state.clickToDrawLine}
            onClick={() => dispatch({type: 'cropper/setClickToDrawLine', payload: true})}
          ><u>N</u>ew line</button>

          &nbsp;

          <button
            className='btn btn-small btn-secondary'
            onClick={removeLast}><u>R</u>emove last</button>
        </div>

        <div className='py2'>
          {
            state.drawingLineId ?
              <p className='h3 gray'>Drawing...</p> :
              (
                state.clickToDrawLine ?
                  <p className='h3 gray'>Click to draw line</p> :
                  (
                    state.sidebarLineId && state.lines[state.sidebarLineId] ?
                      <SidebarLine /> :
                      <SidebarAllLines />
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
                      stroke={id === state.sidebarLineId ? 'blue' : 'red'}
                      strokeWidth={3 / state.scale}
                      onClick={() => handleLineClick(line)}
                      onMouseenter={() => setHoveringLine(true)}
                      onMouseleave={() => setHoveringLine(false)}
                    />

                    <Line
                      points={flatten(line.points)}
                      stroke={'black'}
                      opacity={0}
                      strokeWidth={20 / state.scale}
                      onClick={() => handleLineClick(line)}
                      onMouseenter={() => setHoveringLine(true)}
                      onMouseleave={() => setHoveringLine(false)}
                    />
                  </Fragment>
                )
              })}

              {map(state.intersections, ({location}) => {
                return (
                  <Rect
                    x={location[0]}
                    y={location[1]}
                    key={`${location[0]},${location[1]}`}
                    width={5 / state.scale}
                    height={5 / state.scale}
                    fill='blue'
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
  }

  return (
    <Fragment>
      <form onSubmit={(e) => { e.preventDefault(); save();} }>
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

function SidebarAllLines() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()

  function editLine(id) {
    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId: id }
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
    </Fragment>
  )
}
