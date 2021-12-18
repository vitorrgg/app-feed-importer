const functions = require('firebase-functions')

class QueueController {
  constructor(admin, notification_id) {
    this.queueCollection = admin.firestore().collection('queue_controller')

    this.jobs = []
    this.rear = 0
  }
  
  enqueue(payload) {
    this.jobs[this.rear] = payload
    this.rear = this.rear + 1
  }

  length() {
    return this.rear
  }

  isEmpty() {
    return this.rear === 0
  }

  getFront() {
    if (!this.isEmpty()) {
      return this.jobs[0]
    }
  }

  getLast() {
    if (!this.isEmpty()) {
      return this.jobs[ this.rear -1 ]
    }
  }

  dequeue() {
    if (!this.isEmpty()) {
      this.rear = this.rear -1
      return this.jobs.shift()
    }
  }
}


function run() {
  const queue = new QueueController()
  queue.enqueue('Thiago')
  queue.enqueue('Bruno')
  queue.enqueue('Joao')
  console.log(queue.jobs)
  queue.dequeue()
  console.log(queue.jobs)
}

run()