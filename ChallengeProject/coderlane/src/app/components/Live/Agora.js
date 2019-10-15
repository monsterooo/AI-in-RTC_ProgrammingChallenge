import React from 'react';
import { omit, head, filter, map, get } from 'lodash';
import './style.scss';

const appId = '8e99e984bc5c4abf81ee9b53e6e21fe5';
const localStreamId = 'agora_local_stream';

class Agora extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      agoraState: '',
      devices: [],
      defaultVideo: null,
      defaultAudio: null,
      localStream: null,          // 本地视频流
      clients: {},                // 其他加入的用户流

      localVideoState: true,
      localAudioState: true,
    };
    this.client = null;           // AgoraSDK 实例
  }
  componentDidMount() {
    if(!AgoraRTC.checkSystemRequirements()) return onRequirementError();
    this.getDevices().then(() => {})
  }
  componentDidUpdate(prevProps) {
    const { token } = this.props;

    if (!this.inited && token && token !== prevProps.token) {
      this.inited = true;
      this.init(); // 初始化AgoraSDK实例
    } 
  }
  init() {
    const { uid, channel, token } = this.props;

    // 该方法用于创建客户端，在每次会话里仅调用一次
    this.client = AgoraRTC.createClient({ mode: 'rtc' });
    // 根据appId初始化客户端对象
    this.client.init(appId, () => {
      // 流加入
      this.client.on('stream-added', this.streamAdded);
      // 流被订阅
      this.client.on('stream-subscribed', this.streamSubscribed);
      this.client.on('stream-removed', this.leave);
      this.client.on('peer-leave', this.leave);
      this.join(token, channel, uid);
    }, error => {
      console.log('init 错误', error)
    });
  }
  join = (accessToken, channel, uid) => {
    const { defaultVideo, defaultAudio } = this.state;
    console.log('用户加入视频频道')
    this.client.join(accessToken, channel, uid, uid => {
      try {
        this.localStream = AgoraRTC.createStream({
          streamID: uid,
          audio: true,
          cameraId: defaultVideo.deviceId,
          microphoneId: defaultAudio.deviceId,
          video: true,
          screen: false
        });
        this.localStream.setVideoProfile('360p');
        // 本地流初始化
        this.localStream.init(() => {
          this.localStream.play(localStreamId); // 播放视频
          // 该方法将本地音视频流发布至 SD-RTN。
          // 发布音视频流之后，本地会触发 Client.on("stream-published")
          // 回调；远端会触发 Client.on("stream-added") 回调。
          // client.publish(localStream, onClientPublishError);
          this.client.publish(this.localStream, e => {
            console.log('发布本地视频流失败', e)
          });
        }, e => {
          console.log('本地视频流初始化失败', e)
        });

        this.setState({ agoraState: 'max' });
      } catch (e ) {
        console.log('AgoraRTC.createStream 失败', e);
      }
      
    }, e => {
      console.log('client.join 失败', e)
    });
  }
  leave = e => {
    const { stream } = e;
    const { clients } = this.state;
    stream.stop();
    this.setState({ clients: omit(clients, stream.getId()) });
  }
  streamSubscribed = e => {
    const { stream } = e;
    const id = stream.getId();
    stream.play(`agora_client_${id}`);
  }
  streamAdded = e => {
    const { stream } = e;
    console.log('其他用户流加入-----')
    // 订阅加入的流
    this.client.subscribe(stream, e => {
      console.log("订阅远端流失败", e);
    });
    // 保存所有加入的用户流
    this.setState({
      clients: {
        ...this.state.clients,
        [stream.getId()]: stream,
      }
    });
  }
  
  getDevices = () => {
    return new Promise((resolve, reject) => {
      AgoraRTC.getDevices((devices) => {
        // 以下是获取默认第一个音视频设备
        const defaultAudio = head(filter(devices, v => {
          return v.kind === 'audioinput';
        }));
        const defaultVideo = head(filter(devices, v => {
          return v.kind === 'videoinput';
        }));
  
        this.setState({
          devices,
          defaultVideo,
          defaultAudio,
        }, () => {
          resolve();
        })
      });
    })
  }
  handleVideoControl = () => {
    const { localVideoState } = this.state;

    if (localVideoState) {
      this.localStream.muteVideo();
    } else {
      this.localStream.unmuteVideo();
    }
    this.setState({ localVideoState: !localVideoState });
  }
  handleAudioControl = () => {
    const { localAudioState } = this.state;

    if (localAudioState) {
      this.localStream.muteAudio();
    } else {
      this.localStream.unmuteAudio();
    }
    this.setState({ localAudioState: !localAudioState });
  }
  handleMin = () => {
    this.setState({ agoraState: 'min' });
  }
  handleMax = () => {
    this.setState({ agoraState: 'max' });
  }
  handleEnd = () => {
    this.localStream.stop();
    this.localStream.close();
    this.client.leave();
    this.setState({ agoraState: '', clients: {}, localAudioState: true, localVideoState: true });
  }
  getLocalStream = node => {
    this.localStreamContainer = node;
  }
  render() {
    const { joinClients } = this.props;
    const { agoraState, localVideoState, localAudioState, clients } = this.state;

    return (
      <div className={`video ${agoraState}`}>
        <div className="agora_content">
          <div className="agora_inner">
            <div className="w-100 h-100">
              <div id={localStreamId} ref={this.getLocalStream}>
                {
                  agoraState === 'max' ? (
                    <div className="agora_local_stream_control">
                      <button className="mr-2 btn btn-success btn-sm" onClick={this.handleVideoControl}>
                        <i className={`iconfont icon-${localVideoState ? 'video-mute' : 'video'}`} style={{ fontSize: 12 }} />&nbsp;
                        {localVideoState ? '关闭' : '开启'}
                      </button>
                      <button className="mr-2 btn btn-success btn-sm" onClick={this.handleAudioControl}>
                        <i className={`iconfont icon-${localAudioState ? 'microphone-mute' : 'microphone'}`} />&nbsp;
                        {localAudioState ? '关闭' : '开启'}
                      </button>
                      <button className="mr-2 btn btn-success btn-sm" onClick={this.handleMin}>
                        <i className="iconfont icon-compress-arrows" />&nbsp;
                        最小窗口
                      </button>
                      <button className="btn btn-success btn-sm" onClick={this.handleEnd}>
                        <i className="iconfont icon-stop-solid" />&nbsp;
                        结束
                      </button>
                    </div>
                  ) : (
                    <div className="agora_local_stream_control">
                      <i onClick={this.handleVideoControl} className={`mr-2 iconfont icon-${localVideoState ? 'video-mute' : 'video'}`} />
                      <i onClick={this.handleAudioControl} className={`mr-2 iconfont icon-${localAudioState ? 'microphone-mute' : 'microphone'}`} />
                      <i className="iconfont icon-expand-arrows" onClick={this.handleMax} />
                    </div>
                  )
                }
              </div>
              <div className="agora_clients">
                {map(clients, (v, k) => {
                  const client = joinClients[v.getId()];
                  return (
                    <div key={k} id={`agora_client_${k}`} className={`agora_client`}>
                      <div className="agora_name position-absolute w-100">{get(client, 'name')}</div>
                    </div>
                  )
                })}
              </div>


            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Agora;
