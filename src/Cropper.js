import React, { Fragment, useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import FileBase64 from './FileBase64'
import { Stage, Layer, Image, Line, Rect } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import cuid from 'cuid'
import { filter, each, map, flatten, maxBy, values } from 'lodash'
import { intersect } from 'mathjs'
import { FlexContainer, LeftColumn, RightColumn } from './layout'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const DEFAULT_HOLD_IMAGE_SIZE = 200

export default function Cropper() {
  const state = useSelector(s => s.cropper)

  // Development: save state
  // useEffect(() => {
  //   let savedState = JSON.parse(localStorage.getItem('cropperState-6'))
  //   if (savedState) {
  //     dispatch({type: 'cropper/restoreState', payload: savedState})
  //   }
  // }, [dispatch])
  //
  // useEffect(() => {
  //   if (state) {
  //     localStorage.setItem('cropperState-6', JSON.stringify(state))
  //   }
  // }, [state])
  useEffect(() => {
    window.addEventListener("beforeunload", function (e) {
      e.preventDefault()
      e.returnValue = ''
    })
  }, [])

  return (
    <div>
      {state.step === 'uploadImage' && <UploadImageStep />}
      {state.step === 'drawGrid' && <DrawGridStep />}
      {state.step === 'imageReview' && <ImageReviewStep />}
    </div>
  )
}

function UploadImageStep() {
  const dispatch = useDispatch()

  return (
    <FileBase64
      accept=''
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

function DrawGridStep() {
  const state = useSelector(s => s.cropper)
  const dispatch = useDispatch()
  const [konvaImage] = useImage(state.image.base64)
  const stageContainer = useRef()

  useEffect(() => {
    function handleKeyPress(e) {
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

      if (e.code === 'KeyN') {
        dispatch({
          type: 'cropper/setClickToDrawLine',
          payload: true
        })
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => { document.removeEventListener('keydown', handleKeyPress) }
  }, [dispatch, state.drawingLineId, state.sidebarLineId])

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

  function handleLineClick(line) {
    dispatch({
      type: 'cropper/editLineInSidebar',
      meta: { lineId: line.id }
    })
  }

  function calculateIntersections() {
    const allLines = values(state.lines).slice()
    const intersections = []

    while(allLines.length) {
      let checkingLine = allLines.pop();

      each(allLines, (otherLine) => {
        let res = intersect(
          [
            checkingLine.points[0][0],
            checkingLine.points[0][1]
          ],
          [
            checkingLine.points[1][0],
            checkingLine.points[1][1]
          ],
          [
            otherLine.points[0][0],
            otherLine.points[0][1]
          ],
          [
            otherLine.points[1][0],
            otherLine.points[1][1]
          ]
        )

        if (
          res &&
          res[0] < state.image.width &&
          res[1] < state.image.height &&
          res[0] > 0 &&
          res[1] > 0
        ) {
          intersections.push({
            location: [Math.round(res[0]), Math.round(res[1])],
            lineIds: [checkingLine.id, otherLine.id]
          })
        }
      })
    }

    dispatch({
      type: 'cropper/setIntersections',
      payload: intersections
    })
  }

  function removeLast() {
    let removeLine = maxBy(values(state.lines), 'added')
    let removeId = removeLine && removeLine.id
    if (removeId) dispatch({type: 'cropper/removeLine', payload: removeId});
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

  function doneDrawing() {
    // do something with the intersections...
    dispatch({
      type: 'cropper/setStep',
      payload: 'imageReview'
    })
  }

  return (
    <FlexContainer>
      <LeftColumn sticky={true}>
        <div>
          {
            state.clickToDrawLine ?
              <button disabled>Click image to draw new line</button> :
              <button onClick={() => dispatch({type: 'cropper/setClickToDrawLine', payload: true})}><u>N</u>ew line</button>
          }

          <button onClick={removeLast}>removeLast</button>
          <button onClick={calculateIntersections}>calculateIntersections</button>
          <button
            onClick={doneDrawing}
            disabled={state.intersections.length === 0}
          >doneDrawing</button>
        </div>

        {
          state.drawingLineId ?
            'Drawing...' :
            (
              state.sidebarLineId && state.lines[state.sidebarLineId] ?
                <SidebarLine /> :
                <SidebarAllLines />
            )
        }
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
                  <Line
                    key={id}
                    points={flatten(line.points)}
                    stroke={id === state.sidebarLineId ? 'blue' : 'red'}
                    strokeWidth={3 / state.scale}
                    onClick={() => handleLineClick(line)}
                  />
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
      <span onClick={() => {dispatch({type: 'cropper/closeSidebar'})}} className='link'>Back</span>
      <h4>Name this line...</h4>

      <form onSubmit={(e) => { e.preventDefault(); save();} }>
        <input
          type='text'
          ref={nameInput}
          value={line.name || ''}
          onChange={(e) => dispatch({type: 'cropper/setLineName', meta: { lineId: line.id }, payload: e.target.value})}
        />

        <button type='submit'>Save</button>
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
      <h4>Lines</h4>
      <ul>
        {map(state.lines, (line, id) => {
          return <li key={id}><span className='link' onClick={() => editLine(id)}>{line.name || 'Unnamed line'}</span></li>
        })}
      </ul>

      <h4>Intersections</h4>
      <ul>
        {map(state.intersections, (i) => {
          return <li key={i.location}>[{i.location[0]}, {i.location[1]}]: {getIntersectionName(state.lines, i.lineIds)}</li>
        })}
      </ul>
    </Fragment>
  )
}

function ImageReviewStep() {
  let state = useSelector(s => s.cropper)
  let dispatch = useDispatch()
  let imageReviewState = useSelector(s => s.cropper.imageReview)
  const [konvaImage] = useImage(state.image.base64)
  const activeIntersection = state.intersections[imageReviewState.reviewingIdx]
  const previousIntersection = state.intersections[imageReviewState.reviewingIdx - 1]
  const stageSize = 400
  const imageSize = (
    activeIntersection.size ||
    (previousIntersection && previousIntersection.size) ||
    DEFAULT_HOLD_IMAGE_SIZE
  )

  const hold = useCallback(() => {
    dispatch({type: 'cropper/reviewChangeSize', payload: imageSize})

    dispatch({
      type: 'cropper/reviewImage',
      payload: true
    })

    dispatch({type: 'cropper/reviewNext'})
  }, [dispatch, imageSize])

  const notHold = useCallback(() => {
    dispatch({type: 'cropper/reviewChangeSize', payload: imageSize})

    dispatch({
      type: 'cropper/reviewImage',
      payload: false
    })

    dispatch({type: 'cropper/reviewNext'})
  }, [dispatch, imageSize])

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'KeyH') {
        hold()
      }

      if (e.code === 'KeyN') {
        notHold()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => { document.removeEventListener('keydown', handleKeyPress) }
  }, [hold, notHold])

  function finish() {
    let holdIntersections = filter(state.intersections, (i) => i.review)
    let imageFiles = []

    each(holdIntersections, (i) => {
      let exportStageSize = i.size || DEFAULT_HOLD_IMAGE_SIZE
      let stage = new Konva.Stage({
        container: 'hiddenStageContainer',
        width: exportStageSize,
        height: exportStageSize
      });

      let layer = new Konva.Layer()

      let image = new Konva.Image({
        image: konvaImage,
        x: 0,
        y: 0,
        offsetX: i.location[0] - (exportStageSize / 2),
        offsetY: i.location[1] - (exportStageSize / 2)
      })

      layer.add(image)
      stage.add(layer)

      imageFiles.push({
        name: getIntersectionName(state.lines, i.lineIds),
        data: stage.toDataURL()
      })
    })

    let zip = new JSZip()
    let folder = zip.folder('cropper-export');
    each(imageFiles, ({name, data}) => {
      folder.file(`${name}.png`, data.split('base64,')[1], {base64: true})
    })
    zip.generateAsync({type:"blob"}).then(function(content) {
      saveAs(content, "cropper-export.zip");
    })
  }

  return (
    <FlexContainer>
      <LeftColumn sticky={true}>
        <div>
          <span className='link' onClick={() => dispatch({type: 'cropper/reviewPrevious'})}>Prev</span>
          &nbsp;
          <span className='link' onClick={() => dispatch({type: 'cropper/reviewNext'})}>Next</span>
        </div>

        Reviewing {imageReviewState.reviewingIdx + 1} of {state.intersections.length}

        <div>
          <button onClick={hold}><u>H</u>old</button>
          <button onClick={notHold}><u>N</u>ot hold</button>

          <div>
            <label>Size</label>
            <input
              type='range'
              min={0}
              max={1000}
              value={imageSize}
              onChange={(e) => dispatch({type: 'cropper/reviewChangeSize', payload: e.target.value})}
            />
          </div>
        </div>

        <div>
          <div>Location: [{activeIntersection.location.join(',')}]</div>
          <div>Name: {getIntersectionName(state.lines, activeIntersection.lineIds)}</div>
          <div>Set as: {activeIntersection.review ? 'Hold' : 'Not hold'}</div>
          <div>Size: {imageSize}</div>
        </div>

        <div className='pt4'>
          <button onClick={finish}>Finish</button>
        </div>
      </LeftColumn>
      <RightColumn>
        <div id='hiddenStageContainer' style={{display: 'none'}} />

        <Stage
          width={stageSize}
          height={stageSize}
        >
          <Layer>
            <Image
              image={konvaImage}
              offsetX={activeIntersection.location[0] - (stageSize / 2)}
              offsetY={activeIntersection.location[1] - (stageSize / 2)}
            />

            <Rect
              x={stageSize / 2}
              y={stageSize / 2}
              offsetX={imageSize / 2}
              offsetY={imageSize / 2}
              width={imageSize}
              height={imageSize}
              fill='red'
              opacity={0.2}
            />

            <Rect
              x={stageSize / 2}
              y={stageSize / 2}
              offsetX={3}
              offsetY={3}
              width={6}
              height={6}
              fill='blue'
            />
          </Layer>
        </Stage>
      </RightColumn>
    </FlexContainer>
  )
}

function getIntersectionName(lines, lineIds) {
  let names = map(lineIds, (id) => lines[id].name)

  let numberNames = filter(names, (name) => !!name.match(/[0-9]+/))
  let letterNames = filter(names, (name) => !!name.match(/[A-Za-z]+/))

  return [
    ...letterNames,
    ...numberNames
  ].join('')
}
